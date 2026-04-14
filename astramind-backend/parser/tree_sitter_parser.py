"""
parser/tree_sitter_parser.py — Multi-language AST Parser via Tree-sitter
Supports: Python, JavaScript/TypeScript, Java, Go, Rust.
Handles: function extraction, class extraction, import extraction, docstring detection,
         file chunking with overlap, quality metrics computation (cyclomatic complexity,
         duplicate block detection, TODO counting, undocumented function counting).
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# Language → file extension mapping
# ══════════════════════════════════════════════════════════════════════════════

EXTENSION_TO_LANGUAGE: Dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".sh": "bash",
    ".bash": "bash",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".json": "json",
    ".toml": "toml",
    ".md": "markdown",
    ".html": "html",
    ".css": "css",
    ".sql": "sql",
    ".xml": "xml",
}

SKIP_DIRS = frozenset({
    ".git", "node_modules", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".next", ".nuxt", "target", "out", ".gradle",
    ".idea", ".vscode", "coverage", ".nyc_output", "vendor",
})

SKIP_EXTENSIONS = frozenset({
    ".pyc", ".pyo", ".pyd", ".so", ".dll", ".dylib", ".exe", ".bin",
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".ico", ".webp",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".tar", ".gz", ".rar", ".7z", ".mp3", ".mp4", ".avi",
    ".mov", ".woff", ".woff2", ".ttf", ".eot", ".otf", ".lock",
    ".map", ".min.js",
})

# ══════════════════════════════════════════════════════════════════════════════
# Tree-sitter lazy loader
# ══════════════════════════════════════════════════════════════════════════════

_PARSERS: Dict[str, Any] = {}


def _get_ts_parser(language: str) -> Optional[Any]:
    """
    Lazily load and cache a Tree-sitter parser for the given language.
    Returns None if the language grammar is not installed.
    """
    if language in _PARSERS:
        return _PARSERS[language]

    try:
        import tree_sitter_python
        import tree_sitter_javascript
        import tree_sitter_java
        import tree_sitter_go
        import tree_sitter_rust
        from tree_sitter import Language, Parser  # type: ignore
    except ImportError as exc:
        logger.warning("Tree-sitter not available (%s) — falling back to regex parser", exc)
        _PARSERS[language] = None
        return None

    LANG_MAP = {
        "python": "tree_sitter_python",
        "javascript": "tree_sitter_javascript",
        "typescript": "tree_sitter_javascript",  # TS grammar via JS package
        "java": "tree_sitter_java",
        "go": "tree_sitter_go",
        "rust": "tree_sitter_rust",
    }

    module_name = LANG_MAP.get(language)
    if module_name is None:
        _PARSERS[language] = None
        return None

    try:
        import importlib
        lang_module = importlib.import_module(module_name)
        # tree-sitter >= 0.22 uses Language(module.language())
        lang_obj = Language(lang_module.language())
        parser = Parser(lang_obj)
        _PARSERS[language] = parser
        logger.debug("Loaded Tree-sitter parser for: %s", language)
        return parser
    except Exception as exc:
        logger.warning("Could not load Tree-sitter grammar for %s: %s", language, exc)
        _PARSERS[language] = None
        return None


# ══════════════════════════════════════════════════════════════════════════════
# Extracted entity types
# ══════════════════════════════════════════════════════════════════════════════

class FunctionInfo:
    __slots__ = (
        "name", "start_line", "end_line", "body", "docstring",
        "is_async", "decorators", "params", "language",
    )

    def __init__(
        self,
        name: str,
        start_line: int,
        end_line: int,
        body: str,
        docstring: Optional[str],
        is_async: bool,
        decorators: List[str],
        params: List[str],
        language: str,
    ) -> None:
        self.name = name
        self.start_line = start_line
        self.end_line = end_line
        self.body = body
        self.docstring = docstring
        self.is_async = is_async
        self.decorators = decorators
        self.params = params
        self.language = language

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "body": self.body,
            "docstring": self.docstring,
            "is_async": self.is_async,
            "decorators": self.decorators,
            "params": self.params,
            "language": self.language,
            "line_count": self.end_line - self.start_line + 1,
            "has_docstring": self.docstring is not None,
        }


# ══════════════════════════════════════════════════════════════════════════════
# Main CodeParser class
# ══════════════════════════════════════════════════════════════════════════════

class CodeParser:
    """
    Multi-language source code parser.
    Uses Tree-sitter if available; falls back to regex for unsupported languages.
    """

    CHUNK_SIZE = 40       # lines per chunk
    CHUNK_OVERLAP = 5     # overlap lines between consecutive chunks

    # ── Language detection ────────────────────────────────────────────────────

    @staticmethod
    def detect_language(file_path: str) -> Optional[str]:
        suffix = Path(file_path).suffix.lower()
        # Handle compound extensions like .min.js
        if file_path.endswith(".min.js"):
            return None
        return EXTENSION_TO_LANGUAGE.get(suffix)

    # ── File walking ──────────────────────────────────────────────────────────

    @staticmethod
    def walk_repo(
        repo_path: str, max_file_size_kb: int = 500
    ) -> Generator[Tuple[str, str, str], None, None]:
        """
        Yield (abs_path, relative_path, language) for every indexable source file.
        Skips binary files, huge files, and ignored directories.
        """
        max_bytes = max_file_size_kb * 1024
        repo_root = Path(repo_path)

        for dirpath, dirnames, filenames in os.walk(repo_path, topdown=True):
            # Prune ignored directories in-place (affects os.walk traversal)
            dirnames[:] = [
                d for d in dirnames
                if d not in SKIP_DIRS and not d.startswith(".")
            ]

            for filename in filenames:
                abs_path = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(abs_path, repo_path)

                # Skip by extension
                suffix = Path(filename).suffix.lower()
                if suffix in SKIP_EXTENSIONS:
                    continue
                if filename.endswith(".min.js"):
                    continue

                # Skip by file size
                try:
                    if os.path.getsize(abs_path) > max_bytes:
                        logger.debug("Skipping large file: %s", rel_path)
                        continue
                except OSError:
                    continue

                # Skip binary files (heuristic: null bytes in first 8KB)
                try:
                    with open(abs_path, "rb") as fh:
                        sample = fh.read(8192)
                    if b"\x00" in sample:
                        continue
                except OSError:
                    continue

                language = CodeParser.detect_language(filename)
                if language is None:
                    continue

                yield abs_path, rel_path, language

    # ── Reading ───────────────────────────────────────────────────────────────

    @staticmethod
    def read_file(abs_path: str) -> Optional[str]:
        """Read a text file, trying UTF-8 then latin-1 as fallback."""
        for encoding in ("utf-8", "latin-1"):
            try:
                with open(abs_path, "r", encoding=encoding) as fh:
                    return fh.read()
            except (UnicodeDecodeError, OSError):
                continue
        return None

    # ── Chunking ──────────────────────────────────────────────────────────────

    @classmethod
    def chunk_text(
        cls,
        content: str,
        file_path: str,
        language: str,
        repo_id: str,
        chunk_size: int = CHUNK_SIZE,
        overlap: int = CHUNK_OVERLAP,
    ) -> List[Dict[str, Any]]:
        """
        Split file content into overlapping chunks of `chunk_size` lines.
        Returns list of chunk dicts ready for vector.upsert_chunks().
        """
        lines = content.splitlines()
        chunks: List[Dict[str, Any]] = []
        step = max(1, chunk_size - overlap)

        for i, start in enumerate(range(0, len(lines), step)):
            end = min(start + chunk_size, len(lines))
            chunk_lines = lines[start:end]
            chunk_text = "\n".join(chunk_lines)
            if not chunk_text.strip():
                continue

            chunk_id = str(
                uuid.uuid5(
                    uuid.NAMESPACE_DNS,
                    f"{repo_id}:{file_path}:{start}:{end}",
                )
            )
            chunks.append(
                {
                    "id": chunk_id,
                    "content": chunk_text,
                    "file_path": file_path,
                    "language": language,
                    "function_name": "",   # filled by parse_functions if desired
                    "chunk_index": i,
                    "start_line": start + 1,
                    "end_line": end,
                }
            )
            if end >= len(lines):
                break

        return chunks

    # ── Function extraction ───────────────────────────────────────────────────

    @classmethod
    def parse_functions(
        cls, content: str, language: str, file_path: str = ""
    ) -> List[FunctionInfo]:
        """
        Extract all functions/methods from source code.
        Uses Tree-sitter if grammar is available, otherwise falls back to regex.
        """
        parser = _get_ts_parser(language)
        if parser is not None:
            return cls._ts_parse_functions(content, language, parser, file_path)
        return cls._regex_parse_functions(content, language)

    @classmethod
    def _ts_parse_functions(
        cls,
        content: str,
        language: str,
        parser: Any,
        file_path: str,
    ) -> List[FunctionInfo]:
        """Tree-sitter based function extraction."""
        try:
            tree = parser.parse(content.encode("utf-8"))
        except Exception as exc:
            logger.warning("Tree-sitter parse error for %s: %s", file_path, exc)
            return cls._regex_parse_functions(content, language)

        lines = content.splitlines()
        functions: List[FunctionInfo] = []

        # Node types per language for function definitions
        FUNCTION_NODE_TYPES = {
            "python": {"function_definition", "async_function_definition"},
            "javascript": {
                "function_declaration",
                "function_expression",
                "arrow_function",
                "method_definition",
            },
            "typescript": {
                "function_declaration",
                "function_expression",
                "arrow_function",
                "method_definition",
            },
            "java": {"method_declaration", "constructor_declaration"},
            "go": {"function_declaration", "method_declaration"},
            "rust": {"function_item"},
        }

        target_types = FUNCTION_NODE_TYPES.get(language, {"function_definition"})

        def walk(node: Any) -> None:
            if node.type in target_types:
                func = cls._extract_function_from_node(node, lines, language)
                if func:
                    functions.append(func)
            for child in node.children:
                walk(child)

        walk(tree.root_node)
        return functions

    @classmethod
    def _extract_function_from_node(
        cls, node: Any, lines: List[str], language: str
    ) -> Optional[FunctionInfo]:
        """Extract a FunctionInfo from a Tree-sitter node."""
        try:
            start_line = node.start_point[0]   # 0-indexed
            end_line = node.end_point[0]        # 0-indexed
            body_lines = lines[start_line : end_line + 1]
            body = "\n".join(body_lines)

            # Extract name — look for an 'identifier' or 'name' child
            name = "anonymous"
            for child in node.children:
                if child.type in ("identifier", "name", "property_identifier"):
                    name = child.text.decode("utf-8") if isinstance(child.text, bytes) else str(child.text)
                    break

            # Detect async
            is_async = any(
                child.type == "async" or (hasattr(child, "text") and child.text in (b"async", "async"))
                for child in node.children
            )

            # Detect decorators (Python)
            decorators: List[str] = []
            if language == "python" and node.prev_sibling and node.prev_sibling.type == "decorator":
                sib = node.prev_sibling
                while sib and sib.type == "decorator":
                    dec_text = sib.text
                    if isinstance(dec_text, bytes):
                        dec_text = dec_text.decode("utf-8")
                    decorators.append(dec_text.strip())
                    sib = sib.prev_sibling

            # Extract docstring (Python: first string literal child of body)
            docstring: Optional[str] = None
            if language == "python":
                docstring = cls._extract_python_docstring(node, lines)

            # Extract params (child nodes of type 'parameters' or 'formal_parameters')
            params: List[str] = []
            for child in node.children:
                if child.type in ("parameters", "formal_parameters", "parameter_list"):
                    param_text = child.text
                    if isinstance(param_text, bytes):
                        param_text = param_text.decode("utf-8")
                    params = [p.strip() for p in param_text.strip("()").split(",") if p.strip()]
                    break

            return FunctionInfo(
                name=name,
                start_line=start_line + 1,  # 1-indexed for display
                end_line=end_line + 1,
                body=body,
                docstring=docstring,
                is_async=is_async,
                decorators=decorators,
                params=params,
                language=language,
            )
        except Exception as exc:
            logger.debug("Could not extract function from node: %s", exc)
            return None

    @staticmethod
    def _extract_python_docstring(node: Any, lines: List[str]) -> Optional[str]:
        """
        Look for the first expression_statement > string child inside a function body.
        This is the conventional location for Python docstrings.
        """
        try:
            for child in node.children:
                if child.type == "block":
                    for stmt in child.children:
                        if stmt.type == "expression_statement":
                            for inner in stmt.children:
                                if inner.type == "string":
                                    raw = inner.text
                                    if isinstance(raw, bytes):
                                        raw = raw.decode("utf-8")
                                    return raw.strip('"""').strip("'''").strip('"').strip("'").strip()
                            break  # Only first statement matters
        except Exception:
            pass
        return None

    @classmethod
    def _regex_parse_functions(
        cls, content: str, language: str
    ) -> List[FunctionInfo]:
        """
        Regex-based function extraction fallback for unsupported languages
        or when Tree-sitter grammars aren't installed.
        """
        lines = content.splitlines()
        functions: List[FunctionInfo] = []

        if language == "python":
            pattern = re.compile(
                r"^(?P<indent>\s*)(?P<async>async\s+)?def\s+(?P<name>\w+)\s*\(",
                re.MULTILINE,
            )
            for match in pattern.finditer(content):
                name = match.group("name")
                is_async = bool(match.group("async"))
                start_char = match.start()
                start_line = content[:start_char].count("\n")
                # Find end: next def at same/lower indent level
                indent = len(match.group("indent"))
                end_line = start_line
                for i in range(start_line + 1, len(lines)):
                    stripped = lines[i]
                    line_indent = len(stripped) - len(stripped.lstrip())
                    if stripped.strip() and line_indent <= indent and i > start_line:
                        break
                    end_line = i
                body = "\n".join(lines[start_line : end_line + 1])
                functions.append(
                    FunctionInfo(
                        name=name,
                        start_line=start_line + 1,
                        end_line=end_line + 1,
                        body=body,
                        docstring=None,
                        is_async=is_async,
                        decorators=[],
                        params=[],
                        language=language,
                    )
                )
        elif language in ("javascript", "typescript"):
            pattern = re.compile(
                r"(?:async\s+)?function\s+(\w+)\s*\(|"
                r"(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?.*?\)?\s*=>",
                re.MULTILINE,
            )
            for match in pattern.finditer(content):
                name = match.group(1) or match.group(2) or "anonymous"
                start_line = content[: match.start()].count("\n")
                is_async = "async" in content[max(0, match.start() - 6) : match.start() + 1]
                functions.append(
                    FunctionInfo(
                        name=name,
                        start_line=start_line + 1,
                        end_line=start_line + 1,
                        body="",
                        docstring=None,
                        is_async=is_async,
                        decorators=[],
                        params=[],
                        language=language,
                    )
                )
        elif language == "java":
            pattern = re.compile(
                r"(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+\s*)?\{",
                re.MULTILINE,
            )
            for match in pattern.finditer(content):
                name = match.group(1)
                start_line = content[: match.start()].count("\n")
                functions.append(
                    FunctionInfo(
                        name=name,
                        start_line=start_line + 1,
                        end_line=start_line + 1,
                        body="",
                        docstring=None,
                        is_async=False,
                        decorators=[],
                        params=[],
                        language=language,
                    )
                )

        return functions

    # ── Imports ───────────────────────────────────────────────────────────────

    @staticmethod
    def extract_imports(content: str, language: str) -> List[str]:
        """Extract import statements from source code."""
        imports: List[str] = []
        if language == "python":
            pattern = re.compile(
                r"^(?:from\s+[\w.]+\s+import\s+.+|import\s+.+)$", re.MULTILINE
            )
            imports = pattern.findall(content)
        elif language in ("javascript", "typescript"):
            pattern = re.compile(
                r'^import\s+.+\s+from\s+["\'].+["\'];?$|'
                r'^const\s+.+=\s*require\(["\'].+["\']\);?$',
                re.MULTILINE,
            )
            imports = pattern.findall(content)
        elif language == "java":
            pattern = re.compile(r"^import\s+[\w.]+;$", re.MULTILINE)
            imports = pattern.findall(content)
        elif language == "go":
            pattern = re.compile(r'"([\w./]+)"', re.MULTILINE)
            imports = pattern.findall(content)
        return [imp.strip() for imp in imports[:50]]  # cap at 50

    # ══════════════════════════════════════════════════════════════════════════
    # Quality Metrics (no AI — pure AST/regex, used by trends router)
    # ══════════════════════════════════════════════════════════════════════════

    @classmethod
    def compute_quality_metrics(
        cls, content: str, language: str
    ) -> Dict[str, Any]:
        """
        Compute code quality metrics for a file without any AI calls.
        Returns:
            avg_function_length: mean line count per function
            cyclomatic_complexity: total branch count (if/for/while/and/or)
            todo_count: count of TODO/FIXME/HACK/XXX occurrences
            undocumented_functions: functions with no docstring
            duplicate_blocks: count of duplicate 10-line blocks
        """
        functions = cls.parse_functions(content, language)

        # avg function length
        lengths = [f.end_line - f.start_line + 1 for f in functions]
        avg_function_length = sum(lengths) / len(lengths) if lengths else 0.0

        # cyclomatic complexity (branch count)
        branch_pattern = re.compile(
            r"\b(if|elif|else|for|while|and|or|except|case|switch|catch|&&|\|\|)\b"
        )
        cyclomatic_complexity = float(len(branch_pattern.findall(content)))

        # TODO count
        todo_pattern = re.compile(r"\b(TODO|FIXME|HACK|XXX|BUG|NOTA)\b", re.IGNORECASE)
        todo_count = len(todo_pattern.findall(content))

        # Undocumented functions
        undocumented_functions = sum(
            1 for f in functions
            if f.docstring is None and language in ("python",)
        )

        # Duplicate blocks: hash each consecutive 10-line window
        lines = content.splitlines()
        block_hashes: Dict[str, int] = {}
        BLOCK_SIZE = 10
        for i in range(len(lines) - BLOCK_SIZE + 1):
            block = "\n".join(lines[i : i + BLOCK_SIZE]).strip()
            if not block:
                continue
            h = hashlib.md5(block.encode()).hexdigest()
            block_hashes[h] = block_hashes.get(h, 0) + 1
        duplicate_blocks = sum(1 for count in block_hashes.values() if count > 1)

        return {
            "avg_function_length": round(avg_function_length, 2),
            "cyclomatic_complexity": round(cyclomatic_complexity, 2),
            "todo_count": todo_count,
            "undocumented_functions": undocumented_functions,
            "duplicate_blocks": duplicate_blocks,
            "function_count": len(functions),
        }

    # ══════════════════════════════════════════════════════════════════════════
    # Stale test detection helpers
    # ══════════════════════════════════════════════════════════════════════════

    @classmethod
    def find_test_files(cls, repo_path: str) -> List[str]:
        """
        Return relative paths of all test files in the repo.
        Heuristic: files named test_*, *_test.py, *.test.js, *.spec.ts, etc.
        """
        test_files: List[str] = []
        test_patterns = {
            "python": re.compile(r"(test_.*\.py|.*_test\.py)$"),
            "javascript": re.compile(r"(.*\.test\.(js|ts|jsx|tsx)|.*\.spec\.(js|ts|jsx|tsx))$"),
            "java": re.compile(r".*Test\.java$"),
        }
        combined = re.compile(
            r"(test_.*\.py$|.*_test\.py$"
            r"|.*\.test\.(js|ts|jsx|tsx)$"
            r"|.*\.spec\.(js|ts|jsx|tsx)$"
            r"|.*Test\.java$"
            r"|.*_test\.go$)",
            re.IGNORECASE,
        )
        for _, rel, _ in cls.walk_repo(repo_path):
            if combined.search(rel):
                test_files.append(rel)
        return test_files

    @classmethod
    def extract_test_function_names(
        cls, content: str, language: str
    ) -> List[str]:
        """Extract test function/method names from a test file."""
        functions = cls.parse_functions(content, language)
        prefixes = ("test_", "test", "it_", "it", "should_", "should")
        return [
            f.name
            for f in functions
            if any(f.name.lower().startswith(p) for p in prefixes)
        ]

    # ══════════════════════════════════════════════════════════════════════════
    # Natural Language Query — structural analysis
    # ══════════════════════════════════════════════════════════════════════════

    @classmethod
    def structural_search(
        cls,
        repo_path: str,
        filters: Dict[str, Any],
        max_file_size_kb: int = 500,
    ) -> List[Dict[str, Any]]:
        """
        Apply structural filters (is_async, has_decorator, min_lines, imports_from)
        to all files in the repo without AI.
        Returns list of matching {file_path, function_name, code_snippet, match_reason}.
        """
        results: List[Dict[str, Any]] = []

        is_async_filter: Optional[bool] = filters.get("is_async")
        has_decorator: Optional[str] = filters.get("has_decorator")
        min_lines: Optional[int] = filters.get("min_lines")
        imports_from: Optional[str] = filters.get("imports_from")

        for abs_path, rel_path, language in cls.walk_repo(repo_path, max_file_size_kb):
            content = cls.read_file(abs_path)
            if content is None:
                continue

            # imports_from filter — file-level check first for efficiency
            if imports_from:
                if imports_from.lower() not in content.lower():
                    continue

            functions = cls.parse_functions(content, language)

            for func in functions:
                reasons: List[str] = []

                if is_async_filter is not None:
                    if func.is_async != is_async_filter:
                        continue
                    reasons.append("async function" if is_async_filter else "sync function")

                if has_decorator:
                    if not any(has_decorator in d for d in func.decorators):
                        continue
                    reasons.append(f"has decorator @{has_decorator}")

                if min_lines is not None:
                    line_count = func.end_line - func.start_line + 1
                    if line_count < min_lines:
                        continue
                    reasons.append(f"{line_count} lines (>= {min_lines})")

                results.append(
                    {
                        "file_path": rel_path,
                        "function_name": func.name,
                        "code_snippet": func.body[:500],
                        "match_reason": "; ".join(reasons) if reasons else "structural match",
                        "relevance_score": 1.0,
                    }
                )

        return results[:100]  # cap results for safety


# ── Module-level singleton ────────────────────────────────────────────────────
code_parser = CodeParser()
