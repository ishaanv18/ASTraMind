"""
routers/onboard.py — Onboarding Copilot (Feature 7)
POST /api/v1/onboard/tour    — role-specific onboarding guide (SSE)
POST /api/v1/onboard/explain — explain a code section with git context (SSE)
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ai_client import ai
from database_client import db
from models.schemas import OnboardExplainRequest, OnboardTourRequest
from parser.git_analyzer import GitAnalyzer
from parser.tree_sitter_parser import CodeParser, EXTENSION_TO_LANGUAGE

router = APIRouter()
logger = logging.getLogger("astramind.routers.onboard")


TOUR_SYSTEM = (
    "You are an expert software engineer giving a codebase tour. "
    "Be concise. Cover exactly these 4 sections using markdown:\n\n"
    "## Overview\n"
    "2 sentences: what the project does and its tech stack.\n\n"
    "## Top 3 Files to Read First\n"
    "List 3 files with one sentence each explaining why they matter.\n\n"
    "## Main Data Flow\n"
    "3-4 numbered steps tracing a key request end-to-end.\n\n"
    "## Key Gotchas\n"
    "2 bullet points: most common mistakes or non-obvious things.\n\n"
    "Keep total response under 350 words. Do not add extra sections."
)

EXPLAIN_SYSTEM = (
    "You are a senior engineer explaining code to a new team member. "
    "Structure your explanation with these sections:\n\n"
    "## What This Code Does\n"
    "Plain English, no jargon. Assume the reader knows how to code but not this codebase.\n\n"
    "## Why It Exists\n"
    "Infer the business/technical reason from the git history and context provided.\n\n"
    "## What Breaks If This Is Removed\n"
    "Be specific — what error would occur, which feature would break.\n\n"
    "## Hidden Gotchas\n"
    "Non-obvious side effects, assumptions, or constraints in this code.\n\n"
    "## Dependencies\n"
    "What this code calls and what calls this code (from the context provided)."
)


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/onboard/tour", summary="Generate a role-specific onboarding guide")
async def onboard_tour(request: OnboardTourRequest):
    """
    Streams a customised onboarding guide for a specific developer role.
    Uses repo structure, most-changed files, and language summary as context.
    Role: frontend | backend | fullstack | devops | new
    """
    logger.info(
        "[ONBOARD/TOUR] repo_id=%s role=%s", request.repo_id, request.role
    )

    # Validate repo
    try:
        repo = await db.get_repository(request.repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

    repo_path = repo.get("repo_path", "")
    repo_name = repo.get("name", "this repository")
    language_summary = repo.get("language_summary", {})
    total_files = repo.get("total_files", 0)

    # Build directory tree (async, in executor)
    loop = asyncio.get_event_loop()

    dir_tree = ""
    try:
        dir_tree = await loop.run_in_executor(
            None, GitAnalyzer.get_directory_tree, repo_path, 3
        )
    except Exception as exc:
        logger.warning("[ONBOARD/TOUR] Dir tree failed: %s", exc)
        dir_tree = "Directory structure unavailable."

    # Most-changed files
    most_changed: List[Dict[str, Any]] = []
    try:
        most_changed = await loop.run_in_executor(
            None, GitAnalyzer.get_most_changed_files, repo_path, 100, 10
        )
    except Exception as exc:
        logger.debug("[ONBOARD/TOUR] Most-changed files unavailable (no git): %s", exc)

    # Recent commits for context
    recent_commits: List[Dict[str, Any]] = []
    try:
        recent_commits = await loop.run_in_executor(
            None, GitAnalyzer.get_recent_commits, repo_path, 10
        )
    except Exception as exc:
        logger.debug("[ONBOARD/TOUR] Recent commits unavailable (no git): %s", exc)

    # Format most-changed files
    most_changed_str = ""
    if most_changed:
        parts = [
            f"  - `{f['file_path']}` (changed {f['change_count']} times)"
            for f in most_changed
        ]
        most_changed_str = "Most frequently changed files:\n" + "\n".join(parts)

    # Format recent commits
    commits_str = ""
    if recent_commits:
        parts = [
            f"  - [{c['short_hash']}] {c['message'][:80]}"
            for c in recent_commits[:5]
        ]
        commits_str = "Recent commit messages:\n" + "\n".join(parts)

    lang_str = ", ".join(f"{k} ({v} files)" for k, v in language_summary.items())

    role_context = {
        "frontend": "Focus on UI components, styling, routing, and API integration points.",
        "backend": "Focus on API endpoints, business logic, database models, and authentication.",
        "fullstack": "Cover both frontend and backend, and how they connect via APIs.",
        "devops": "Focus on deployment, CI/CD, infrastructure, environment configuration, and monitoring.",
        "new": "Provide a beginner-friendly complete overview covering everything essential.",
    }.get(request.role.lower(), "Provide a comprehensive overview.")

    user_prompt = (
        f"## Repository: {repo_name}\n"
        f"Developer role: **{request.role}** — {role_context}\n\n"
        f"### Languages\n{lang_str or 'Not detected'} | Total files: {total_files}\n\n"
        f"### Directory Structure\n```\n{dir_tree[:3000]}\n```\n\n"
        + (f"### {most_changed_str}\n\n" if most_changed_str else "")
        + (f"### {commits_str}\n\n" if commits_str else "")
        + "Generate the onboarding guide now."
    )

    logger.info("[ONBOARD/TOUR] Calling AI for role=%s", request.role)
    try:
        guide = await ai.call(TOUR_SYSTEM, user_prompt, max_tokens=1024)
    except Exception as exc:
        logger.error("[ONBOARD/TOUR] AI error: %s", exc)
        return {"guide": f"AI error: {exc}"}
    logger.info("[ONBOARD/TOUR] Done. len=%d", len(guide))
    return {"guide": guide}


@router.post("/onboard/explain", summary="Explain a specific code section")
async def onboard_explain(request: OnboardExplainRequest):
    """
    Fetches the requested lines from the file, enriches with git blame history,
    then streams a plain-English explanation including why it exists and gotchas.
    """
    logger.info(
        "[ONBOARD/EXPLAIN] repo_id=%s file=%s L%d-L%d",
        request.repo_id,
        request.file_path,
        request.line_start,
        request.line_end,
    )

    if request.line_end < request.line_start:
        raise HTTPException(
            status_code=422, detail="line_end must be >= line_start."
        )
    if request.line_end - request.line_start > 200:
        raise HTTPException(
            status_code=422, detail="Maximum 200 lines per explain request."
        )

    # Validate repo
    try:
        repo = await db.get_repository(request.repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

    repo_path = repo.get("repo_path", "")
    abs_path = os.path.join(repo_path, request.file_path)

    # Read file content
    content = CodeParser.read_file(abs_path)
    if content is None:
        raise HTTPException(
            status_code=404,
            detail=f"File not found or unreadable: {request.file_path}",
        )

    lines = content.splitlines()
    start_idx = max(0, request.line_start - 1)
    end_idx = min(len(lines), request.line_end)
    code_section = "\n".join(lines[start_idx:end_idx])

    if not code_section.strip():
        raise HTTPException(status_code=400, detail="The specified line range is empty.")

    # Git blame for selected lines (async)
    blame_entries: List[Dict[str, Any]] = []
    loop = asyncio.get_event_loop()
    try:
        blame_entries = await loop.run_in_executor(
            None,
            GitAnalyzer.get_blame,
            repo_path,
            request.file_path,
            request.line_start,
            request.line_end,
        )
    except Exception as exc:
        logger.warning("[ONBOARD/EXPLAIN] git blame failed (non-fatal): %s", exc)

    # Format blame context
    blame_context = ""
    if blame_entries:
        unique_commits = {}
        for entry in blame_entries:
            h = entry["commit_hash"]
            if h not in unique_commits:
                unique_commits[h] = entry
        blame_context = "Git blame context (who wrote this and when):\n" + "\n".join(
            f"  - [{e['commit_hash']}] {e['author']} on {e['date_iso'][:10]}: line {e['line_number']}"
            for e in list(unique_commits.values())[:10]
        )

    lang = EXTENSION_TO_LANGUAGE.get(
        os.path.splitext(request.file_path)[1].lower(), ""
    )

    user_prompt = (
        f"## File: `{request.file_path}` (Lines {request.line_start}–{request.line_end})\n\n"
        f"```{lang}\n{code_section}\n```\n\n"
        + (f"## {blame_context}\n\n" if blame_context else "")
        + "Explain this code now."
    )

    logger.info("[ONBOARD/EXPLAIN] Calling AI. blame_entries=%d", len(blame_entries))
    try:
        explanation = await ai.call(EXPLAIN_SYSTEM, user_prompt, max_tokens=1024)
    except Exception as exc:
        logger.error("[ONBOARD/EXPLAIN] AI error: %s", exc)
        return {"explanation": f"AI error: {exc}"}
    logger.info("[ONBOARD/EXPLAIN] Done. len=%d", len(explanation))
    return {"explanation": explanation}
