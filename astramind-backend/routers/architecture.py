"""
routers/architecture.py — Architecture Guardian (Feature 6)
POST /api/v1/architecture/check — detect patterns, check new code compliance (SSE)
GET  /api/v1/architecture/patterns/{repo_id} — return stored patterns
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from ai_client import ai
from database_client import db
from models.schemas import ArchitectureCheckRequest
from parser.embedder import embedder
from parser.tree_sitter_parser import CodeParser
from vector_client import vector

router = APIRouter()
logger = logging.getLogger("astramind.routers.architecture")


PATTERN_DETECT_SYSTEM = (
    "You are a software architect analyzing a codebase to identify its architectural patterns. "
    "Analyze the provided code samples and identify these pattern categories:\n"
    "1. naming_conventions — e.g. snake_case functions, PascalCase classes\n"
    "2. error_handling — e.g. try/except with specific exceptions, returning Result types\n"
    "3. import_style — e.g. absolute imports, specific __init__ exports\n"
    "4. decorator_usage — e.g. @router.get, @property, @staticmethod patterns\n"
    "5. response_structure — e.g. always returns {data, status}, uses Pydantic models\n"
    "6. async_patterns — e.g. always uses async/await, uses run_in_executor for blocking calls\n"
    "7. logging_style — e.g. logger.info at start and end of functions\n"
    "8. dependency_injection — e.g. singletons, passed as parameters\n\n"
    "Return ONLY a JSON array, no markdown, no explanation:\n"
    '[{"pattern_type": "...", "description": "...", "example_file": "..."}]'
)

ARCHITECTURE_CHECK_SYSTEM = (
    "Strict software architect enforcing architectural consistency.\n"
    "## Violations\nFormat: `[LINE N] [PATTERN] issue — fix`. Or 'No violations detected.'\n\n"
    "## Score\nX/100 with 1-sentence breakdown.\n\n"
    "## Refactored Snippet\nRewrite the worst violation only."
)


async def _detect_and_save_patterns(repo_id: str, repo_path: str) -> List[Dict[str, Any]]:
    """
    Sample representative files from the codebase, send to AI to detect patterns,
    save them to DB and return the list.
    """
    logger.info("[ARCH] Detecting patterns for repo_id=%s", repo_id)

    # Gather sample files (up to 8 Python/JS files)
    samples: List[str] = []
    count = 0
    for abs_path, rel_path, language in CodeParser.walk_repo(repo_path, max_file_size_kb=300):
        if language not in ("python", "javascript", "typescript"):
            continue
        content = CodeParser.read_file(abs_path)
        if not content or not content.strip():
            continue
        samples.append(
            f"### {rel_path}\n```{language}\n{content[:2000]}\n```"
        )
        count += 1
        if count >= 8:
            break

    if not samples:
        return []

    user_prompt = (
        "Analyze these code samples to identify architectural patterns:\n\n"
        + "\n\n".join(samples)
    )

    try:
        raw_json = await ai.call_with_retry(
            PATTERN_DETECT_SYSTEM, user_prompt, max_tokens=1500
        )
    except Exception as exc:
        logger.error("[ARCH] Pattern detection AI call failed: %s", exc)
        return []

    # Parse JSON response
    import json as json_mod
    patterns: List[Dict[str, Any]] = []
    try:
        # Strip any accidental markdown fences
        clean = raw_json.strip().strip("```json").strip("```").strip()
        patterns = json_mod.loads(clean)
        if not isinstance(patterns, list):
            patterns = []
    except Exception as exc:
        logger.warning("[ARCH] Could not parse patterns JSON (%s). Raw: %s", exc, raw_json[:200])
        # Fallback: create a generic pattern entry
        patterns = [
            {
                "pattern_type": "general",
                "description": "Pattern detection returned non-JSON output. Manual review recommended.",
                "example_file": samples[0].split("\n")[0].replace("### ", ""),
            }
        ]

    # Save to DB
    try:
        await db.save_repo_patterns(repo_id, patterns)
        logger.info("[ARCH] Saved %d patterns for repo_id=%s", len(patterns), repo_id)
    except Exception as exc:
        logger.error("[ARCH] Could not save patterns: %s", exc)

    return patterns


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/architecture/check",
    summary="Check new code against codebase architectural patterns (SSE)",
)
async def architecture_check(request: ArchitectureCheckRequest):
    """
    1. Retrieves or detects codebase architectural patterns.
    2. Streams a compliance check of `new_code` against those patterns.
    Reports violations with line numbers, a refactored version, and a compatibility score.
    """
    logger.info(
        "[ARCH] Check: repo_id=%s file=%s code_len=%d",
        request.repo_id,
        request.new_file_path,
        len(request.new_code),
    )

    # Validate repo
    try:
        repo = await db.get_repository(request.repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

    repo_path = repo.get("repo_path", "")

    # Get patterns — detect if not stored yet
    try:
        patterns = await db.get_repo_patterns(request.repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    if not patterns:
        logger.info("[ARCH] No stored patterns — detecting now from codebase...")
        try:
            patterns = await _detect_and_save_patterns(request.repo_id, repo_path)
        except Exception as exc:
            logger.warning("[ARCH] Pattern detection failed: %s", exc)
            patterns = []

    # Format patterns for the prompt
    if patterns:
        patterns_text = "\n".join(
            f"- **{p.get('pattern_type', 'general')}**: {p.get('description', '')} "
            + (f"(example: `{p.get('example_file', '')}`)" if p.get("example_file") else "")
            for p in patterns
        )
    else:
        patterns_text = "No specific patterns detected — apply general best practices for this language."

    # Detect language from file path
    from pathlib import Path
    from parser.tree_sitter_parser import EXTENSION_TO_LANGUAGE
    lang = EXTENSION_TO_LANGUAGE.get(Path(request.new_file_path).suffix.lower(), "")

    user_prompt = (
        f"## Codebase Architectural Patterns\n{patterns_text}\n\n"
        f"## New Code to Check\nFile: `{request.new_file_path}`\n"
        f"```{lang}\n{request.new_code}\n```\n\n"
        "Check this new code against the architectural patterns and provide your assessment."
    )

    logger.info("[ARCH] Calling AI check. patterns=%d", len(patterns))

    try:
        review = await ai.call(ARCHITECTURE_CHECK_SYSTEM, user_prompt, max_tokens=900)
    except Exception as exc:
        review = f"Architecture check failed: {exc}"

    return {
        "review": review,
        "patterns_used": len(patterns),
        "file": request.new_file_path,
    }


@router.get(
    "/architecture/patterns/{repo_id}",
    summary="Get stored architectural patterns for a repository",
)
async def get_patterns(repo_id: str):
    """
    Return all detected architectural patterns for a repository.
    Trigger detection first via POST /architecture/check if none exist.
    """
    logger.info("[ARCH] Get patterns: repo_id=%s", repo_id)
    try:
        repo = await db.get_repository(repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {repo_id} not found.")

    try:
        patterns = await db.get_repo_patterns(repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    return {
        "repo_id": repo_id,
        "patterns": patterns,
        "total": len(patterns),
        "hint": "POST /api/v1/architecture/check to trigger pattern detection if empty.",
    }


@router.post(
    "/architecture/detect-patterns/{repo_id}",
    summary="Force re-detection of architectural patterns",
)
async def detect_patterns(repo_id: str):
    """
    Re-runs pattern detection on the codebase and overwrites stored patterns.
    Useful after major refactors.
    """
    logger.info("[ARCH] Force re-detect patterns: repo_id=%s", repo_id)
    try:
        repo = await db.get_repository(repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {repo_id} not found.")

    repo_path = repo.get("repo_path", "")
    try:
        patterns = await _detect_and_save_patterns(repo_id, repo_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Pattern detection failed: {exc}")

    return {
        "repo_id": repo_id,
        "patterns_detected": len(patterns),
        "patterns": patterns,
    }
