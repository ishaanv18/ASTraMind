"""
routers/nl_query.py — Natural Language Code Query (Advanced Feature 3)
POST /api/v1/nl/query — parse NL intent, execute structural/semantic/pattern search
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException

from ai_client import ai
from config import settings
from database_client import db
from models.schemas import NLQueryRequest, NLQueryResponse, NLQueryResultItem
from parser.embedder import embedder
from parser.tree_sitter_parser import CodeParser
from vector_client import vector

router = APIRouter()
logger = logging.getLogger("astramind.routers.nl_query")


INTENT_PARSE_SYSTEM = (
    "You are a code search query parser. Parse the user's natural language query "
    "into a structured search intent. Return ONLY valid JSON, no markdown, no explanation.\n\n"
    "Return this exact schema:\n"
    "{\n"
    '  "intent_type": "semantic" | "structural" | "pattern",\n'
    '  "filters": {\n'
    '    "is_async": true | false | null,\n'
    '    "has_decorator": "decorator_name" | null,\n'
    '    "min_lines": integer | null,\n'
    '    "imports_from": "module_name" | null,\n'
    '    "language": "python" | "javascript" | null\n'
    "  },\n"
    '  "semantic_query": "natural language search string for vector search",\n'
    '  "pattern_regex": "regex string for pattern search" | null,\n'
    '  "explanation": "one sentence explanation of search strategy"\n'
    "}\n\n"
    "Rules:\n"
    "- Use 'structural' when query mentions specific code properties "
    "(async/sync, decorators, line count, imports)\n"
    "- Use 'semantic' when query is about functionality or behaviour\n"
    "- Use 'pattern' when query mentions a specific pattern or regex-matchable structure\n"
    "Examples:\n"
    "  'find all async functions without error handling' "
    "→ structural + is_async=true + semantic_query='functions missing try/except'\n"
    "  'show everywhere we touch the database' "
    "→ semantic + semantic_query='database queries ORM SQL'\n"
    "  'find functions longer than 50 lines' "
    "→ structural + min_lines=50\n"
    "  'which files import from utils?' "
    "→ structural + imports_from='utils'"
)


async def _parse_nl_intent(query: str) -> Dict[str, Any]:
    """
    Use a fast non-streaming AI call to parse a NL query into structured intent.
    Falls back to a semantic search if parsing fails.
    """
    try:
        raw = await ai.call_with_retry(
            INTENT_PARSE_SYSTEM,
            f"Query: {query}",
            max_tokens=300,
        )
        clean = raw.strip().strip("```json").strip("```").strip()
        parsed = json.loads(clean)
        logger.info(
            "[NL_QUERY] Parsed intent: type=%s filters=%s",
            parsed.get("intent_type"),
            parsed.get("filters"),
        )
        return parsed
    except Exception as exc:
        logger.warning(
            "[NL_QUERY] Intent parsing failed (%s) — falling back to semantic", exc
        )
        return {
            "intent_type": "semantic",
            "filters": {},
            "semantic_query": query,
            "pattern_regex": None,
            "explanation": "Fallback: semantic search",
        }


async def _execute_structural(
    repo_id: str,
    repo_path: str,
    filters: Dict[str, Any],
    semantic_query: str,
    query_embedding: List[float],
) -> List[NLQueryResultItem]:
    """Execute structural AST search with optional vector re-ranking."""
    loop = asyncio.get_event_loop()

    # Run structural search (AST + filters)
    raw_results = await loop.run_in_executor(
        None,
        CodeParser.structural_search,
        repo_path,
        filters,
        settings.MAX_FILE_SIZE_KB,
    )

    if not raw_results:
        return []

    # Re-rank with vector similarity if we have a semantic query
    if semantic_query and query_embedding:
        try:
            vector_results = await loop.run_in_executor(
                None,
                lambda: vector.query(repo_id, query_embedding, top_k=20),
            )
            # Build a set of high-scoring file_path+function combos from vector results
            vector_boost: Dict[str, float] = {}
            for vr in vector_results:
                key = f"{vr['file_path']}:{vr.get('function_name', '')}"
                vector_boost[key] = vr["score"]

            # Boost structural results that also match semantically
            for r in raw_results:
                key = f"{r['file_path']}:{r.get('function_name', '')}"
                vector_score = vector_boost.get(key, 0.0)
                # Combine: 0.6 structural + 0.4 semantic
                r["relevance_score"] = round(0.6 + 0.4 * vector_score, 4)

            raw_results.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        except Exception as exc:
            logger.warning("[NL_QUERY] Vector re-ranking failed: %s", exc)

    return [
        NLQueryResultItem(
            file_path=r["file_path"],
            function_name=r.get("function_name"),
            code_snippet=r.get("code_snippet", "")[:500],
            match_reason=r.get("match_reason", "structural match"),
            relevance_score=float(r.get("relevance_score", 1.0)),
        )
        for r in raw_results[:30]
    ]


async def _execute_semantic(
    repo_id: str,
    query_embedding: List[float],
) -> List[NLQueryResultItem]:
    """Pure vector similarity search."""
    loop = asyncio.get_event_loop()
    try:
        raw = await loop.run_in_executor(
            None,
            lambda: vector.query(repo_id, query_embedding, top_k=20),
        )
        return [
            NLQueryResultItem(
                file_path=r["file_path"],
                function_name=r.get("function_name"),
                code_snippet=r["content"][:500],
                match_reason=f"semantic similarity (score: {r['score']:.3f})",
                relevance_score=float(r["score"]),
            )
            for r in raw
        ]
    except Exception as exc:
        logger.error("[NL_QUERY] Semantic search failed: %s", exc)
        return []


async def _execute_pattern(
    repo_id: str,
    repo_path: str,
    pattern_regex: Optional[str],
    semantic_query: str,
    query_embedding: List[float],
) -> List[NLQueryResultItem]:
    """
    Regex + AST combination search.
    If pattern_regex is invalid or None, falls back to semantic search.
    """
    if not pattern_regex:
        return await _execute_semantic(repo_id, query_embedding)

    try:
        compiled = re.compile(pattern_regex, re.MULTILINE | re.IGNORECASE)
    except re.error as exc:
        logger.warning("[NL_QUERY] Bad regex '%s': %s — falling back to semantic", pattern_regex, exc)
        return await _execute_semantic(repo_id, query_embedding)

    loop = asyncio.get_event_loop()
    results: List[NLQueryResultItem] = []

    def _regex_scan() -> List[NLQueryResultItem]:
        found: List[NLQueryResultItem] = []
        for abs_path, rel_path, language in CodeParser.walk_repo(repo_path, settings.MAX_FILE_SIZE_KB):
            content = CodeParser.read_file(abs_path)
            if not content:
                continue
            lines = content.splitlines()
            for line_num, line in enumerate(lines, start=1):
                if compiled.search(line):
                    context_start = max(0, line_num - 3)
                    context_end = min(len(lines), line_num + 3)
                    snippet = "\n".join(lines[context_start:context_end])
                    found.append(
                        NLQueryResultItem(
                            file_path=rel_path,
                            function_name=None,
                            code_snippet=snippet[:500],
                            match_reason=f"regex match on line {line_num}: `{line.strip()[:80]}`",
                            relevance_score=1.0,
                        )
                    )
                    if len(found) >= 50:
                        return found
        return found

    results = await loop.run_in_executor(None, _regex_scan)
    return results[:30]


# ══════════════════════════════════════════════════════════════════════════════
# Endpoint
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/nl/query",
    response_model=NLQueryResponse,
    summary="Natural language code search: semantic | structural | pattern",
)
async def nl_query(request: NLQueryRequest) -> NLQueryResponse:
    """
    Executes a natural language query against an indexed codebase in 2 steps:

    **Step 1** — AI parses the query into structured intent (fast, non-streaming):
    - intent_type: semantic | structural | pattern
    - filters: is_async, has_decorator, min_lines, imports_from, language
    - semantic_query: refined search string

    **Step 2** — Executes the appropriate search strategy:
    - semantic → vector cosine similarity search
    - structural → Tree-sitter AST traversal with filters + optional vector re-ranking
    - pattern → regex scan across all files + semantic fallback

    Examples:
    - "find all async functions without error handling"
    - "show everywhere we touch the database"
    - "find functions longer than 50 lines"
    - "which files import from utils?"
    - "find hardcoded passwords"
    """
    logger.info(
        "[NL_QUERY] repo_id=%s query=%r", request.repo_id, request.query[:80]
    )

    # Validate repo
    try:
        repo = await db.get_repository(request.repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

    repo_path = repo.get("repo_path", "")
    loop = asyncio.get_event_loop()

    # Step 1: Parse intent (AI call, fast, non-streaming)
    intent = await _parse_nl_intent(request.query)
    intent_type = intent.get("intent_type", "semantic")
    filters = intent.get("filters") or {}
    semantic_query = intent.get("semantic_query") or request.query
    pattern_regex = intent.get("pattern_regex")

    # Embed semantic query for vector operations
    query_embedding: List[float] = []
    try:
        query_embedding = await loop.run_in_executor(
            None, embedder.embed_query, semantic_query[:4000]
        )
    except Exception as exc:
        logger.warning("[NL_QUERY] Embedding failed: %s", exc)

    # Step 2: Execute search
    results: List[NLQueryResultItem] = []

    if intent_type == "structural":
        results = await _execute_structural(
            request.repo_id, repo_path, filters, semantic_query, query_embedding
        )
    elif intent_type == "pattern":
        results = await _execute_pattern(
            request.repo_id, repo_path, pattern_regex, semantic_query, query_embedding
        )
    else:  # semantic (default)
        if not query_embedding:
            raise HTTPException(
                status_code=500, detail="Embedding unavailable — cannot perform semantic search."
            )
        results = await _execute_semantic(request.repo_id, query_embedding)

    logger.info(
        "[NL_QUERY] Done. type=%s results=%d", intent_type, len(results)
    )

    return NLQueryResponse(
        repo_id=request.repo_id,
        query=request.query,
        intent_type=intent_type,
        results=results,
        total=len(results),
    )
