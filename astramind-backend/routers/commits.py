"""
routers/commits.py — Smart Commit Message Generator (Advanced Feature 6)
POST /api/v1/commits/message          — generate Conventional Commit message from diff
POST /api/v1/commits/history-analysis — score and analyse last N commit messages
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException

from ai_client import ai
from database_client import db
from models.schemas import (
    CommitHistoryAnalysisRequest,
    CommitHistoryAnalysisResponse,
    CommitMessageRequest,
    CommitMessageResponse,
)
from parser.git_analyzer import GitAnalyzer

router = APIRouter()
logger = logging.getLogger("astramind.routers.commits")


COMMIT_MESSAGE_SYSTEM = (
    "You are a senior engineer writing a git commit message following the "
    "Conventional Commits specification (https://www.conventionalcommits.org).\n\n"
    "Rules:\n"
    "- Subject line: <type>(<scope>): <description> (max 72 chars)\n"
    "- Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert\n"
    "- Scope: the affected component/module (optional but preferred)\n"
    "- Body: explains WHAT and WHY, not HOW (wrap at 72 chars)\n"
    "- Breaking changes: BREAKING CHANGE: in footer\n"
    "- Issue references: Closes #N or Fixes #N at end\n\n"
    "Return ONLY valid JSON with these exact keys:\n"
    '{"subject": "...", "body": "...", "breaking_changes": "none" | "description", '
    '"issue_keywords": "Closes #N" | "none"}\n\n'
    "No markdown, no explanation, no code blocks. Just the JSON object."
)

HISTORY_ANALYSIS_SYSTEM = (
    "You are a senior engineer auditing commit message quality. "
    "Analyse the provided commit messages and return ONLY valid JSON:\n"
    "{\n"
    '  "quality_score": 0-100,\n'
    '  "issues": ["issue description", ...],\n'
    '  "recommendations": ["actionable recommendation", ...]\n'
    "}\n\n"
    "Quality scoring rubric:\n"
    "- 90-100: All messages follow Conventional Commits, clear, specific\n"
    "- 70-89: Most follow conventions, minor issues\n"
    "- 50-69: Some conventions followed, many vague messages\n"
    "- 30-49: Mostly vague, no conventions\n"
    "- 0-29: 'WIP', 'fix', 'stuff', single-word messages throughout\n\n"
    "Look for: vague messages (fix, update, changes), missing type prefix, "
    "missing scope, overly long subjects, missing body for complex changes, "
    "and inconsistent conventions.\n\n"
    "Return ONLY the JSON object. No markdown, no explanation."
)


def _parse_diff_context(diff_text: str) -> Dict[str, Any]:
    """
    Extract high-level context from a diff string:
    - files_changed, functions_added, functions_modified, functions_deleted
    - primary file type (to suggest scope)
    """
    files_changed: List[str] = []
    functions_added: List[str] = []
    functions_removed: List[str] = []

    for line in diff_text.splitlines():
        if line.startswith("diff --git"):
            parts = line.split(" b/")
            if parts:
                files_changed.append(parts[-1].strip())
        elif line.startswith("+") and not line.startswith("+++"):
            func_match = re.match(
                r"^\+\s*(?:async\s+)?(?:def|function|fn|func)\s+(\w+)\s*\(", line
            )
            if func_match:
                functions_added.append(func_match.group(1))
        elif line.startswith("-") and not line.startswith("---"):
            func_match = re.match(
                r"^-\s*(?:async\s+)?(?:def|function|fn|func)\s+(\w+)\s*\(", line
            )
            if func_match:
                functions_removed.append(func_match.group(1))

    # Determine primary scope from files changed
    scope = _infer_scope(files_changed)

    return {
        "files_changed": files_changed,
        "functions_added": functions_added,
        "functions_removed": functions_removed,
        "scope": scope,
        "total_files": len(files_changed),
    }


def _infer_scope(files: List[str]) -> str:
    """
    Heuristically infer the scope (component) from changed file paths.
    Examples: routers/auth.py → auth, models/user.py → models
    """
    if not files:
        return ""

    # Collect parent directory names
    dirs: Dict[str, int] = {}
    for f in files:
        parts = f.replace("\\", "/").split("/")
        if len(parts) > 1:
            parent = parts[-2]
            if parent not in (".", "", "__pycache__"):
                dirs[parent] = dirs.get(parent, 0) + 1

    if dirs:
        # Return most common parent directory
        return max(dirs, key=lambda k: dirs[k])

    # Fall back to base filename without extension
    import os
    return os.path.splitext(os.path.basename(files[0]))[0]


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/commits/message",
    response_model=CommitMessageResponse,
    summary="Generate a Conventional Commit message from staged diff",
)
async def generate_commit_message(request: CommitMessageRequest) -> CommitMessageResponse:
    """
    Generates a structured commit message from a diff following Conventional Commits.

    If diff_text is provided, uses it directly.
    If only repo_id is provided, reads staged changes via `git diff HEAD`.

    Returns:
    - subject: "feat(auth): add JWT refresh token rotation"
    - body: multi-line explanation
    - breaking_changes: "none" or description
    - issue_keywords: "Closes #42" or "none"
    """
    logger.info(
        "[COMMITS/MSG] repo_id=%s diff_len=%s",
        request.repo_id,
        len(request.diff_text or ""),
    )

    diff_text = request.diff_text

    if not diff_text:
        # Auto-read staged changes from git
        try:
            repo = await db.get_repository(request.repo_id)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Database error: {exc}")
        if repo is None:
            raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

        repo_path = repo.get("repo_path", "")
        loop = asyncio.get_event_loop()
        try:
            diff_text = await loop.run_in_executor(
                None, GitAnalyzer.get_staged_diff, repo_path
            )
        except Exception as exc:
            logger.warning("[COMMITS/MSG] git not available: %s", exc)
            # Return a placeholder message explaining the issue
            return CommitMessageResponse(
                subject="chore: update codebase",
                body="Git is not installed on this server. Provide diff_text manually to generate commit messages.",
                breaking_changes="none",
                issue_keywords="none",
            )

    if not diff_text or not diff_text.strip():
        raise HTTPException(
            status_code=400,
            detail="No diff available. Stage your changes first or provide diff_text.",
        )

    # Parse diff for context
    diff_context = _parse_diff_context(diff_text)

    # Truncate diff for context window
    MAX_DIFF_CHARS = 8_000
    truncated_diff = diff_text[:MAX_DIFF_CHARS]
    if len(diff_text) > MAX_DIFF_CHARS:
        truncated_diff += f"\n\n# ... [{len(diff_text) - MAX_DIFF_CHARS} chars truncated]"

    user_prompt = (
        f"## Diff Context\n"
        f"- Files changed: {diff_context['total_files']} ({', '.join(diff_context['files_changed'][:5])})\n"
        f"- Functions added: {', '.join(diff_context['functions_added'][:5]) or 'none'}\n"
        f"- Functions removed: {', '.join(diff_context['functions_removed'][:5]) or 'none'}\n"
        f"- Suggested scope: {diff_context['scope'] or 'not deterministic'}\n\n"
        f"## Diff\n```diff\n{truncated_diff}\n```\n\n"
        "Generate the commit message JSON now."
    )

    try:
        raw_response = await ai.call_with_retry(
            COMMIT_MESSAGE_SYSTEM, user_prompt, max_tokens=500
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI call failed: {exc}")

    # Parse JSON response
    try:
        clean = raw_response.strip().strip("```json").strip("```").strip()
        parsed = json.loads(clean)
    except json.JSONDecodeError as exc:
        logger.warning("[COMMITS/MSG] JSON parse failed: %s. Raw: %s", exc, raw_response[:200])
        # Attempt to extract subject line as fallback
        lines = raw_response.strip().splitlines()
        subject = next((l for l in lines if l.strip()), "chore: update codebase")
        parsed = {
            "subject": subject[:72],
            "body": "",
            "breaking_changes": "none",
            "issue_keywords": "none",
        }

    logger.info("[COMMITS/MSG] Generated: %s", parsed.get("subject", "")[:60])

    return CommitMessageResponse(
        subject=str(parsed.get("subject", ""))[:72],
        body=str(parsed.get("body", "")),
        breaking_changes=str(parsed.get("breaking_changes", "none")),
        issue_keywords=str(parsed.get("issue_keywords", "none")),
    )


@router.post(
    "/commits/history-analysis",
    response_model=CommitHistoryAnalysisResponse,
    summary="Score and analyse the quality of recent commit messages",
)
async def analyse_commit_history(
    request: CommitHistoryAnalysisRequest,
) -> CommitHistoryAnalysisResponse:
    """
    Fetches the last N commit messages via GitPython and uses AI to score them
    on clarity, specificity, and Conventional Commits compliance.

    Returns:
    - quality_score: 0-100
    - issues: list of specific problems found
    - recommendations: ordered list of actionable improvements
    """
    logger.info(
        "[COMMITS/HIST] repo_id=%s limit=%d", request.repo_id, request.limit
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

    # Fetch commit history
    try:
        commits = await loop.run_in_executor(
            None, GitAnalyzer.get_recent_commits, repo_path, request.limit
        )
    except Exception as exc:
        logger.warning("[COMMITS/HIST] Git not available: %s", exc)
        return CommitHistoryAnalysisResponse(
            repo_id=request.repo_id,
            quality_score=0,
            issues=["Git is not installed on this server — cannot read commit history."],
            recommendations=["Install Git from https://git-scm.com/download/win to enable commit history analysis."],
            commits_analyzed=0,
        )

    if not commits:
        raise HTTPException(
            status_code=404,
            detail="No commits found in this repository.",
        )

    # Format commit messages for AI
    commit_lines = [
        f"[{c['short_hash']}] {c['message'][:120]}"
        for c in commits
    ]
    commit_block = "\n".join(commit_lines)

    # Quick local stats (no AI needed for basic pattern detection)
    conventional_pattern = re.compile(
        r"^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)"
        r"(?:\([^)]+\))?!?:\s+.+",
        re.IGNORECASE,
    )
    vague_pattern = re.compile(
        r"^(wip|fix|fixes|update|updates|changes?|stuff|misc|minor|cleanup|"
        r"temp|test|testing|work|working)\s*$",
        re.IGNORECASE,
    )

    conventional_count = sum(
        1 for c in commits if conventional_pattern.match(c["message"].splitlines()[0])
    )
    vague_count = sum(
        1 for c in commits if vague_pattern.match(c["message"].splitlines()[0].strip())
    )

    user_prompt = (
        f"## Commit History ({len(commits)} commits)\n\n"
        f"{commit_block}\n\n"
        f"## Pre-computed Stats\n"
        f"- Conventional Commits compliant: {conventional_count}/{len(commits)} ({conventional_count*100//len(commits)}%)\n"
        f"- Vague/meaningless messages: {vague_count}/{len(commits)}\n\n"
        "Analyse the quality and return the JSON."
    )

    try:
        raw_response = await ai.call_with_retry(
            HISTORY_ANALYSIS_SYSTEM, user_prompt, max_tokens=800
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI call failed: {exc}")

    # Parse response
    try:
        clean = raw_response.strip().strip("```json").strip("```").strip()
        parsed = json.loads(clean)
    except json.JSONDecodeError as exc:
        logger.warning("[COMMITS/HIST] JSON parse failed: %s", exc)
        # Compute a basic score locally as fallback
        basic_score = int((conventional_count / max(len(commits), 1)) * 100)
        parsed = {
            "quality_score": basic_score,
            "issues": [f"{vague_count} vague commit messages detected"] if vague_count else [],
            "recommendations": [
                "Adopt Conventional Commits format: feat|fix|chore(scope): description"
            ],
        }

    logger.info(
        "[COMMITS/HIST] Score=%s for repo_id=%s", parsed.get("quality_score"), request.repo_id
    )

    return CommitHistoryAnalysisResponse(
        repo_id=request.repo_id,
        quality_score=int(parsed.get("quality_score", 50)),
        issues=[str(i) for i in parsed.get("issues", [])],
        recommendations=[str(r) for r in parsed.get("recommendations", [])],
        commits_analyzed=len(commits),
    )
