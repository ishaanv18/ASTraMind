"""
routers/trends.py — Code Quality Trend Tracker (Advanced Feature 2)
POST /api/v1/trends/quality — compute AST metrics per commit, stream AI narrative
GET  /api/v1/trends/history/{repo_id} — return stored time-series data
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException

from ai_client import ai
from database_client import db
from models.schemas import (
    QualityMetricPoint,
    QualityTrendRequest,
    QualityTrendResponse,
)
from parser.git_analyzer import GitAnalyzer
from parser.tree_sitter_parser import CodeParser

router = APIRouter()
logger = logging.getLogger("astramind.routers.trends")


TREND_ANALYSIS_SYSTEM = (
    "You are a code quality analyst. Fill in EXACTLY this template, nothing else:\n\n"
    "**Strength:** [one sentence about what the codebase does well]\n\n"
    "**Main Risk:** [one sentence about the biggest quality concern]\n\n"
    "**Fix 1:** [one concrete action to improve quality]\n\n"
    "**Fix 2:** [one concrete action to improve quality]\n\n"
    "Rules: each item is ONE sentence only. No lists. No extra sections. Total under 100 words."
)


# ══════════════════════════════════════════════════════════════════════════════
# Pure AST metric computation (no AI, completely free)
# ══════════════════════════════════════════════════════════════════════════════

def _compute_metrics_for_commit(
    repo_path: str,
    commit: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """
    Compute quality metrics for all Python files at a specific commit
    using only Tree-sitter AST analysis — no AI involved.
    """
    commit_hash = commit["hash"]
    python_files = GitAnalyzer.list_python_files_at_commit(repo_path, commit_hash)

    if not python_files:
        return None

    # Aggregate metrics across all Python files in this commit
    all_avg_lengths: List[float] = []
    all_complexities: List[float] = []
    total_todos = 0
    total_undocumented = 0
    total_duplicates = 0
    files_processed = 0

    for file_path in python_files[:50]:  # cap at 50 files per commit for speed
        content = GitAnalyzer.get_file_content_at_commit(repo_path, file_path, commit_hash)
        if not content or not content.strip():
            continue

        try:
            metrics = CodeParser.compute_quality_metrics(content, "python")
            if metrics["function_count"] > 0:
                all_avg_lengths.append(metrics["avg_function_length"])
            all_complexities.append(metrics["cyclomatic_complexity"])
            total_todos += metrics["todo_count"]
            total_undocumented += metrics["undocumented_functions"]
            total_duplicates += metrics["duplicate_blocks"]
            files_processed += 1
        except Exception as exc:
            logger.debug("[TRENDS] Metric error for %s@%s: %s", file_path, commit_hash[:8], exc)
            continue

    if files_processed == 0:
        return None

    return {
        "repo_id": "",  # filled by caller
        "commit_hash": commit_hash,
        "commit_date": datetime.fromisoformat(commit["date_iso"]) if commit.get("date_iso") else datetime.utcnow(),
        "avg_function_length": round(
            sum(all_avg_lengths) / len(all_avg_lengths) if all_avg_lengths else 0.0, 2
        ),
        "cyclomatic_complexity": round(
            sum(all_complexities) / len(all_complexities) if all_complexities else 0.0, 2
        ),
        "todo_count": total_todos,
        "undocumented_functions": total_undocumented,
        "duplicate_blocks": total_duplicates,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/trends/quality",
    summary="Compute per-commit quality metrics + stream AI narrative (SSE)",
)
async def quality_trends(request: QualityTrendRequest):
    """
    Walks git history for the past N days, computes AST quality metrics per commit
    (no AI — pure static analysis), saves them to DB, then streams an AI analysis
    of the trends.

    Metrics computed (all AI-free):
    - avg_function_length: mean lines per function
    - cyclomatic_complexity: branch count (if/for/while/and/or)
    - todo_count: TODO/FIXME/HACK/XXX occurrences
    - undocumented_functions: functions without docstrings
    - duplicate_blocks: count of duplicate 10-line blocks
    """
    logger.info(
        "[TRENDS] repo_id=%s days_back=%d", request.repo_id, request.days_back
    )

    # Validate repo
    try:
        repo = await db.get_repository(request.repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

    repo_path = repo.get("repo_path", "")
    since = datetime.utcnow() - timedelta(days=request.days_back)
    loop = asyncio.get_event_loop()

    # Get commits in the time window
    try:
        commits = await loop.run_in_executor(
            None, GitAnalyzer.get_commits_since_date, repo_path, since
        )
    # ── No-git fallback: compute metrics from current indexed files ──────────
    except Exception as exc:
        logger.warning("[TRENDS] Git not available: %s", exc)
        # Scan ALL source files regardless of language
        SOURCE_EXTS = (".py", ".java", ".kt", ".js", ".ts", ".jsx", ".tsx",
                       ".go", ".rs", ".cpp", ".c", ".cs", ".rb", ".php",
                       ".swift", ".scala", ".groovy")
        all_files: List[str] = []
        lang_counts: Dict[str, int] = {}
        try:
            for root, _dirs, fnames in os.walk(repo_path):
                # Skip build/vendor/node_modules dirs
                _dirs[:] = [d for d in _dirs if d not in
                            {"node_modules", ".git", "build", "target", "dist", "__pycache__", ".gradle"}]
                for fn in fnames:
                    if fn.endswith(SOURCE_EXTS):
                        ext = os.path.splitext(fn)[1].lower()
                        lang_counts[ext] = lang_counts.get(ext, 0) + 1
                        all_files.append(os.path.join(root, fn))
        except Exception:
            pass

        # Basic metrics via text analysis (works for any language)
        total_lines = 0
        total_todos = 0
        long_functions = 0
        agg = {"complexities": [], "count": 0}

        for fp in (all_files or [])[:100]:
            try:
                content = CodeParser.read_file(fp)
                if not content:
                    continue
                lines = content.splitlines()
                total_lines += len(lines)
                total_todos += sum(
                    1 for l in lines if any(t in l.upper() for t in ("TODO", "FIXME", "HACK", "XXX"))
                )
                # Count methods/functions by looking for common patterns
                fn_keywords = ("def ", "public ", "private ", "protected ", "void ",
                               "function ", "func ", "fn ")
                fn_count = sum(1 for l in lines if any(k in l for k in fn_keywords))
                if fn_count > 0:
                    avg_len = len(lines) / fn_count
                    if avg_len > 30:
                        long_functions += 1
                # Try tree-sitter metrics for supported languages
                lang = "python" if fp.endswith(".py") else ("javascript" if fp.endswith((".js", ".jsx", ".ts", ".tsx")) else None)
                if lang:
                    try:
                        m = CodeParser.compute_quality_metrics(content, lang)
                        agg["complexities"].append(m["cyclomatic_complexity"])
                    except Exception:
                        pass
                agg["count"] += 1
            except Exception:
                continue

        if agg["count"] == 0:
            return {"analysis": "No source files found. Make sure the repository has been indexed.", "data_points": 0}

        lang_str = ", ".join(f"{ext.lstrip('.')} ({n}" + " file" + ("s" if n != 1 else ") ") for ext, n in sorted(lang_counts.items(), key=lambda x: -x[1])[:6])
        cx_avg = round(sum(agg["complexities"]) / len(agg["complexities"]), 2) if agg["complexities"] else "N/A"
        snapshot_prompt = (
            f"Metrics for '{repo.get('name', 'unknown')}':\n"
            f"- Languages: {lang_str}\n"
            f"- Source files: {agg['count']}, total lines: {total_lines:,}\n"
            f"- TODO/FIXME comments: {total_todos}\n"
            f"- Files with very long methods (>30 lines avg): {long_functions}\n"
            + (f"- Avg cyclomatic complexity: {cx_avg}\n" if agg["complexities"] else "")
            + "\nFill in the template now:"
        )
        try:
            analysis = await ai.call(TREND_ANALYSIS_SYSTEM, snapshot_prompt, max_tokens=200)
        except Exception as ai_exc:
            analysis = f"AI analysis failed: {ai_exc}"
        return {"analysis": analysis, "data_points": agg["count"], "snapshot_only": True}

    # ── Git path: has commits ────────────────────────────────────────────────
    if not commits:
        return {
            "analysis": f"No commits found in the past {request.days_back} days. Try increasing the days range.",
            "data_points": 0,
        }

    # Sample commits evenly (max 20)
    MAX_COMMITS = 20
    sampled = commits[::max(1, len(commits) // MAX_COMMITS)][:MAX_COMMITS]

    logger.info("[TRENDS] Processing %d commits (sampled from %d)...", len(sampled), len(commits))

    time_series: List[QualityMetricPoint] = []
    saved_metrics: List[Dict[str, Any]] = []

    for commit in sampled:
        try:
            metrics = await loop.run_in_executor(None, _compute_metrics_for_commit, repo_path, commit)
            if metrics is None:
                continue
            metrics["repo_id"] = request.repo_id
            saved_metrics.append(metrics)
            time_series.append(QualityMetricPoint(
                date=commit["date_iso"][:10],
                commit_hash=commit["short_hash"],
                avg_function_length=metrics["avg_function_length"],
                cyclomatic_complexity=metrics["cyclomatic_complexity"],
                todo_count=metrics["todo_count"],
                undocumented_functions=metrics["undocumented_functions"],
                duplicate_blocks=metrics["duplicate_blocks"],
            ))
        except Exception as exc:
            logger.warning("[TRENDS] Error computing metrics for %s: %s", commit.get("short_hash", "?"), exc)

    for m in saved_metrics:
        try:
            await db.save_quality_metrics(m)
        except Exception:
            pass

    if not time_series:
        return {"analysis": "No quality metrics could be computed. Ensure the repository contains Python files.", "data_points": 0}

    # Build prompt
    trend_table = "| Date | Commit | Avg Fn Len | Complexity | TODOs | Undocumented | Duplicates |\n"
    trend_table += "|------|--------|------------|------------|-------|--------------|------------|\n"
    for pt in time_series:
        trend_table += f"| {pt.date} | {pt.commit_hash} | {pt.avg_function_length} | {pt.cyclomatic_complexity} | {pt.todo_count} | {pt.undocumented_functions} | {pt.duplicate_blocks} |\n"

    user_prompt = (
        f"Repository: {repo.get('name', 'this repo')} | Last {request.days_back} days | {len(sampled)} commits\n\n"
        f"{trend_table}\nAnalyse trends now."
    )

    logger.info("[TRENDS] Calling AI. data_points=%d", len(time_series))
    try:
        analysis = await ai.call(TREND_ANALYSIS_SYSTEM, user_prompt, max_tokens=900)
    except Exception as exc:
        analysis = f"AI analysis failed: {exc}"

    return {"analysis": analysis, "data_points": len(time_series)}


@router.get(
    "/trends/history/{repo_id}",
    response_model=QualityTrendResponse,
    summary="Return stored quality metric history",
)
async def get_trend_history(
    repo_id: str,
    days_back: int = 30,
) -> QualityTrendResponse:
    """Return previously computed quality metrics from the database."""
    logger.info("[TRENDS] History: repo_id=%s days_back=%d", repo_id, days_back)

    try:
        repo = await db.get_repository(repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {repo_id} not found.")

    try:
        metrics = await db.get_quality_metrics(repo_id, days_back)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    time_series = [
        QualityMetricPoint(
            date=(m.get("commit_date") or m.get("recorded_at") or "")[:10],
            commit_hash=m.get("commit_hash") or "",
            avg_function_length=float(m.get("avg_function_length") or 0),
            cyclomatic_complexity=float(m.get("cyclomatic_complexity") or 0),
            todo_count=int(m.get("todo_count") or 0),
            undocumented_functions=int(m.get("undocumented_functions") or 0),
            duplicate_blocks=int(m.get("duplicate_blocks") or 0),
        )
        for m in metrics
    ]

    return QualityTrendResponse(
        repo_id=repo_id,
        days_back=days_back,
        time_series=time_series,
    )
