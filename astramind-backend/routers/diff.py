"""
routers/diff.py — Semantic PR Diff Analysis (Feature 4)
POST /api/v1/diff/analyze        — stream analysis of a git diff
POST /api/v1/diff/pr-description — stream a formatted GitHub PR description
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from ai_client import ai
from database_client import db
from models.schemas import DiffAnalyzeRequest, PRDescriptionRequest


router = APIRouter()
logger = logging.getLogger("astramind.routers.diff")


# ── System prompts ────────────────────────────────────────────────────────────

DIFF_ANALYSIS_SYSTEM = (
    "Senior architect reviewing a PR diff. Respond with exactly these sections:\n"
    "## Summary\n(2-3 sentences)\n\n"
    "## Key Changes\n(bullet list of behaviour changes)\n\n"
    "## Risks\nRating: LOW|MEDIUM|HIGH — reason in 1 sentence.\n\n"
    "## Missing Tests\n(bullet list of untested behaviours, or 'None detected.')"
)

PR_DESCRIPTION_SYSTEM = (
    "Senior engineer writing a GitHub PR description. Use this format:\n"
    "## Summary\n(2-3 sentences)\n\n"
    "## Changes\n- bullet list\n\n"
    "## Testing\n- what was tested\n\n"
    "## Checklist\n- [ ] Tests added\n- [ ] Docs updated\n- [ ] Breaking changes noted"
)


# ── Diff parsing helpers ──────────────────────────────────────────────────────

def _parse_diff_summary(diff_text: str) -> Dict[str, Any]:
    """
    Extract summary statistics from a unified diff string.
    Returns: {files_changed, lines_added, lines_removed, file_list}
    """
    files_changed: List[str] = []
    lines_added = 0
    lines_removed = 0

    for line in diff_text.splitlines():
        if line.startswith("diff --git"):
            # Extract filename: diff --git a/foo.py b/foo.py
            parts = line.split(" b/")
            if parts:
                files_changed.append(parts[-1].strip())
        elif line.startswith("+") and not line.startswith("+++"):
            lines_added += 1
        elif line.startswith("-") and not line.startswith("---"):
            lines_removed += 1

    return {
        "files_changed": files_changed,
        "lines_added": lines_added,
        "lines_removed": lines_removed,
        "total_files": len(files_changed),
    }


def _extract_functions_from_diff(diff_text: str) -> List[str]:
    """
    Heuristic: find function/method names that appear in diff hunks.
    Looks for def/function/fn/func patterns in added/removed lines.
    """
    func_pattern = re.compile(
        r"^[+-]\s*(?:async\s+)?(?:def|function|func|fn|public|private|protected)?\s*"
        r"(?:def |function |fn )?(\w+)\s*\(",
        re.MULTILINE,
    )
    return list({m.group(1) for m in func_pattern.finditer(diff_text)})


async def _get_diff_text(
    request: DiffAnalyzeRequest,
) -> tuple[str, Dict[str, Any]]:
    """
    Resolve the diff text from either raw diff_text or GitPython branch comparison.
    Returns (diff_text, summary_stats).
    """
    if request.diff_text:
        diff_text = request.diff_text
    elif request.repo_id and request.base_branch and request.compare_branch:
        # Need local repo path
        try:
            repo_record = await db.get_repository(request.repo_id)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Database error: {exc}")
        if repo_record is None:
            raise HTTPException(
                status_code=404,
                detail=f"Repository {request.repo_id} not found.",
            )

        repo_path = repo_record.get("repo_path", "")
        try:
            from parser.git_analyzer import GitAnalyzer
            loop = asyncio.get_event_loop()
            diff_text = await loop.run_in_executor(
                None,
                GitAnalyzer.get_diff,
                repo_path,
                request.base_branch,
                request.compare_branch,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Git diff failed: {exc}",
            )
    else:
        raise HTTPException(
            status_code=422,
            detail="Provide either diff_text OR (repo_id + base_branch + compare_branch).",
        )

    if not diff_text or not diff_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Diff is empty — no changes between the specified branches.",
        )

    summary = _parse_diff_summary(diff_text)
    return diff_text, summary


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/diff/analyze",
    summary="Semantic diff analysis: summary, risks, architectural violations, intent drift (SSE)",
)
async def analyze_diff(request: DiffAnalyzeRequest):
    """
    Accepts a raw diff string or branch names for a cloned repo.
    Streams a structured analysis covering:
    - Plain English summary of logical changes
    - Architectural violations
    - Intent drift (docstring vs implementation mismatch)
    - Risk rating: LOW / MEDIUM / HIGH
    - Missing test coverage
    """
    logger.info(
        "[DIFF/ANALYZE] repo_id=%s base=%s compare=%s diff_len=%s",
        request.repo_id,
        request.base_branch,
        request.compare_branch,
        len(request.diff_text or ""),
    )

    diff_text, summary = await _get_diff_text(request)
    functions_modified = _extract_functions_from_diff(diff_text)

    # Truncate diff to stay within context window (~12k chars ≈ 3k tokens)
    MAX_DIFF_CHARS = 12_000
    truncated = diff_text[:MAX_DIFF_CHARS]
    if len(diff_text) > MAX_DIFF_CHARS:
        truncated += f"\n\n... [diff truncated. Showing first {MAX_DIFF_CHARS} chars of {len(diff_text)} total]"

    user_prompt = (
        f"## Diff Statistics\n"
        f"- Files changed: {summary['total_files']} ({', '.join(summary['files_changed'][:10])})\n"
        f"- Lines added: {summary['lines_added']} | Lines removed: {summary['lines_removed']}\n"
        f"- Functions modified: {', '.join(functions_modified[:15]) or 'none detected'}\n\n"
        f"## Unified Diff\n```diff\n{truncated}\n```"
    )

    logger.info(
        "[DIFF/ANALYZE] Calling AI. files=%d funcs=%d",
        summary["total_files"],
        len(functions_modified),
    )

    try:
        analysis = await ai.call(DIFF_ANALYSIS_SYSTEM, user_prompt, max_tokens=900)
    except Exception as exc:
        analysis = f"AI analysis failed: {exc}"

    return {
        "analysis": analysis,
        "stats": {
            "files_changed": summary["total_files"],
            "lines_added": summary["lines_added"],
            "lines_removed": summary["lines_removed"],
            "files": summary["files_changed"],
            "functions_modified": functions_modified,
        },
    }


@router.post(
    "/diff/pr-description",
    summary="Generate a formatted GitHub PR description from a diff (SSE)",
)
async def generate_pr_description(request: PRDescriptionRequest):
    """
    Stream a complete, professional GitHub pull request description
    inferred from the diff. Includes summary, changes, checklist, and issue references.
    """
    logger.info(
        "[DIFF/PR-DESC] repo_id=%s diff_len=%d",
        request.repo_id,
        len(request.diff_text),
    )

    if not request.diff_text or not request.diff_text.strip():
        raise HTTPException(status_code=400, detail="diff_text must not be empty.")

    summary = _parse_diff_summary(request.diff_text)
    MAX_DIFF_CHARS = 10_000
    truncated = request.diff_text[:MAX_DIFF_CHARS]

    user_prompt = (
        f"## Diff Statistics\n"
        f"- Files changed: {summary['total_files']}"
        + (f" ({', '.join(summary['files_changed'][:8])})" if summary["files_changed"] else "")
        + f"\n- Lines added: {summary['lines_added']} | Lines removed: {summary['lines_removed']}\n\n"
        f"## Unified Diff\n```diff\n{truncated}\n```\n\n"
        "Write the GitHub PR description now."
    )

    logger.info("[DIFF/PR-DESC] Calling AI for PR description.")

    try:
        pr_description = await ai.call(PR_DESCRIPTION_SYSTEM, user_prompt, max_tokens=900)
    except Exception as exc:
        pr_description = f"PR description generation failed: {exc}"

    return {"pr_description": pr_description, "stats": summary}
