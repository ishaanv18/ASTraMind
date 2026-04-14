"""
routers/tests.py — Test Intelligence Engine (Feature 9)
POST /api/v1/tests/generate — AI generates complete tests for a file/snippet (SSE)
POST /api/v1/tests/stale    — detect stale tests vs current function signatures
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from ai_client import ai
from database_client import db
from models.schemas import (
    StaleTestItem,
    StaleTestRequest,
    StaleTestResponse,
    TestGenerateRequest,
)
from parser.tree_sitter_parser import CodeParser, EXTENSION_TO_LANGUAGE

router = APIRouter()
logger = logging.getLogger("astramind.routers.tests")


TEST_GEN_SYSTEM = (
    "Principal test engineer. Generate a complete runnable test file.\n"
    "- Python → pytest with fixtures. JS/TS → Jest describe/it. Java → JUnit 5.\n"
    "- Each function: happy path + 2 edge cases + error case.\n"
    "- Mock external deps (DB, HTTP, filesystem).\n"
    "- Return ONLY the test file code, no explanations outside code."
)

STALE_TEST_SYSTEM = (
    "You are a senior engineer analysing whether tests are stale. "
    "You will compare original function signatures with their current implementations. "
    "For each test that appears to test a function that has changed, "
    "explain what specifically changed and why the test is likely broken or incomplete.\n\n"
    "Return ONLY a JSON array:\n"
    '[{"test_file": "...", "test_function": "...", "original_function": "...", '
    '"reason": "..."}]\n\n'
    "If no tests appear stale, return an empty array: []"
)


async def _get_file_content_and_functions(
    repo_path: str, file_path: str
) -> tuple[str, List[Any], str]:
    """
    Read a file from disk, detect its language, and parse all functions.
    Returns (content, functions, language).
    """
    abs_path = os.path.join(repo_path, file_path)
    content = CodeParser.read_file(abs_path)
    if content is None:
        raise FileNotFoundError(f"Cannot read file: {file_path}")

    from pathlib import Path
    lang = EXTENSION_TO_LANGUAGE.get(Path(file_path).suffix.lower(), "python")
    functions = CodeParser.parse_functions(content, lang, file_path)
    return content, functions, lang


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/tests/generate",
    summary="Generate complete tests for a file or code snippet (SSE)",
)
async def generate_tests(request: TestGenerateRequest):
    """
    Streams a complete, runnable test file for the target code.
    Accepts either:
    - repo_id + target_file_path: reads from indexed repo, finds existing tests for context
    - code_snippet + language: tests a direct code snippet

    Uses Tree-sitter to parse all functions and hands them to the AI
    with existing test patterns as context.
    """
    logger.info(
        "[TESTS/GEN] repo_id=%s file=%s snippet=%s lang=%s",
        request.repo_id,
        request.target_file_path,
        bool(request.code_snippet),
        request.language,
    )

    code_to_test = ""
    language = request.language or "python"
    existing_test_context = ""
    file_path_display = "<snippet>"

    if request.code_snippet:
        code_to_test = request.code_snippet
        language = request.language or "python"

    elif request.repo_id and request.target_file_path:
        # Validate repo
        try:
            repo = await db.get_repository(request.repo_id)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Database error: {exc}")
        if repo is None:
            raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

        repo_path = repo.get("repo_path", "")
        file_path_display = request.target_file_path

        # Read target file
        try:
            loop = asyncio.get_event_loop()
            code_to_test, functions, language = await loop.run_in_executor(
                None,
                _get_file_content_and_functions,
                repo_path,
                request.target_file_path,
            )
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"File read error: {exc}")

        # Find existing test files for context (max 2)
        try:
            test_files = await loop.run_in_executor(
                None, CodeParser.find_test_files, repo_path
            )
            test_samples: List[str] = []
            for tf in test_files[:2]:
                tc = CodeParser.read_file(os.path.join(repo_path, tf))
                if tc:
                    test_samples.append(
                        f"### Existing test file: {tf}\n```{language}\n{tc[:1500]}\n```"
                    )
            if test_samples:
                existing_test_context = (
                    "\n\n## Existing Test Patterns (follow these conventions):\n\n"
                    + "\n\n".join(test_samples)
                )
        except Exception as exc:
            logger.warning("[TESTS/GEN] Could not find test files: %s", exc)

    else:
        raise HTTPException(
            status_code=422,
            detail="Provide code_snippet OR (repo_id + target_file_path).",
        )

    if not code_to_test or not code_to_test.strip():
        raise HTTPException(status_code=400, detail="No code content to generate tests for.")

    # Truncate to stay within context
    MAX_CODE_CHARS = 8_000
    if len(code_to_test) > MAX_CODE_CHARS:
        code_to_test = code_to_test[:MAX_CODE_CHARS] + "\n# ... [truncated]"

    user_prompt = (
        f"## Source File: `{file_path_display}`\n"
        f"```{language}\n{code_to_test}\n```"
        + existing_test_context
        + "\n\nGenerate the complete test file now."
    )

    logger.info(
        "[TESTS/GEN] Calling AI. lang=%s code_len=%d",
        language,
        len(code_to_test),
    )

    try:
        tests = await ai.call(TEST_GEN_SYSTEM, user_prompt, max_tokens=700)
    except Exception as exc:
        tests = f"Test generation failed: {exc}"

    return {
        "tests": tests,
        "language": language,
        "file": file_path_display,
    }


@router.post(
    "/tests/stale",
    response_model=StaleTestResponse,
    summary="Detect stale tests whose source functions have changed",
)
async def detect_stale_tests(request: StaleTestRequest) -> StaleTestResponse:
    """
    Compares function signatures in test files against current source implementations.
    Uses Tree-sitter AST comparison + AI to reason about staleness.

    Returns a list of tests that are likely broken or out of date
    because the function they test has changed signature or behaviour.
    """
    logger.info("[TESTS/STALE] repo_id=%s", request.repo_id)

    # Validate repo
    try:
        repo = await db.get_repository(request.repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

    repo_path = repo.get("repo_path", "")
    loop = asyncio.get_event_loop()

    # Find all test files
    try:
        test_files = await loop.run_in_executor(
            None, CodeParser.find_test_files, repo_path
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Test file discovery failed: {exc}")

    if not test_files:
        return StaleTestResponse(repo_id=request.repo_id, stale_tests=[], total=0)

    # Collect test function names and map to source function names
    # Heuristic: test_function_name → function_name (strip test_ prefix)
    def _collect_test_info(tf: str) -> Optional[Dict[str, Any]]:
        abs_path = os.path.join(repo_path, tf)
        content = CodeParser.read_file(abs_path)
        if not content:
            return None
        from pathlib import Path
        lang = EXTENSION_TO_LANGUAGE.get(Path(tf).suffix.lower(), "python")
        test_funcs = CodeParser.extract_test_function_names(content, lang)
        return {
            "test_file": tf,
            "test_functions": test_funcs,
            "content_sample": content[:2000],
            "language": lang,
        }

    test_infos: List[Dict[str, Any]] = []
    for tf in test_files[:10]:  # cap at 10 test files
        try:
            info = await loop.run_in_executor(None, _collect_test_info, tf)
            if info:
                test_infos.append(info)
        except Exception as exc:
            logger.warning("[TESTS/STALE] Error reading test file %s: %s", tf, exc)

    if not test_infos:
        return StaleTestResponse(repo_id=request.repo_id, stale_tests=[], total=0)

    # Collect current source functions for comparison
    source_functions: Dict[str, str] = {}  # func_name → "file_path:start_line"

    def _collect_source_functions() -> Dict[str, str]:
        result: Dict[str, str] = {}
        for abs_path, rel_path, lang in CodeParser.walk_repo(repo_path, 300):
            # Skip test files themselves
            if any(rel_path == tf for tf in test_files):
                continue
            content = CodeParser.read_file(abs_path)
            if not content:
                continue
            funcs = CodeParser.parse_functions(content, lang, rel_path)
            for f in funcs:
                result[f.name] = f"{rel_path}:{f.start_line}"
        return result

    try:
        source_functions = await loop.run_in_executor(None, _collect_source_functions)
    except Exception as exc:
        logger.warning("[TESTS/STALE] Source function collection failed: %s", exc)

    # Build comparison prompt for AI
    test_summary_lines: List[str] = []
    for ti in test_infos:
        funcs_str = ", ".join(ti["test_functions"][:20]) if ti["test_functions"] else "(none detected)"
        test_summary_lines.append(
            f"**{ti['test_file']}** tests: {funcs_str}"
        )

    source_summary_lines = [
        f"- `{fname}` at {location}"
        for fname, location in list(source_functions.items())[:50]
    ]

    prompt = (
        "## Test Files and Their Test Functions\n"
        + "\n".join(test_summary_lines)
        + "\n\n## Current Source Functions\n"
        + "\n".join(source_summary_lines)
        + "\n\n## Sample Test File Content\n"
        + "\n\n".join(
            f"### {ti['test_file']}\n```{ti['language']}\n{ti['content_sample']}\n```"
            for ti in test_infos[:3]
        )
        + "\n\nIdentify which tests are stale and why."
    )

    import json as json_mod

    try:
        raw_response = await ai.call_with_retry(STALE_TEST_SYSTEM, prompt, max_tokens=1500)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI call failed: {exc}")

    # Parse AI response
    stale_tests: List[StaleTestItem] = []
    try:
        clean = raw_response.strip().strip("```json").strip("```").strip()
        parsed = json_mod.loads(clean)
        if isinstance(parsed, list):
            for item in parsed:
                stale_tests.append(
                    StaleTestItem(
                        test_file=item.get("test_file", ""),
                        test_function=item.get("test_function", ""),
                        reason=item.get("reason", ""),
                        original_function=item.get("original_function"),
                    )
                )
    except Exception as exc:
        logger.warning("[TESTS/STALE] Could not parse AI JSON response: %s", exc)
        # Return graceful empty result rather than crashing
        return StaleTestResponse(repo_id=request.repo_id, stale_tests=[], total=0)

    logger.info(
        "[TESTS/STALE] Found %d stale tests for repo_id=%s",
        len(stale_tests),
        request.repo_id,
    )

    return StaleTestResponse(
        repo_id=request.repo_id,
        stale_tests=stale_tests,
        total=len(stale_tests),
    )
