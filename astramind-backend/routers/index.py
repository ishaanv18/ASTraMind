"""
routers/index.py — Codebase Ingestion & Indexing Engine (Feature 1)
POST /api/v1/index/repository  — kick off background indexing job
GET  /api/v1/index/status/{repo_id} — poll indexing progress
GET  /api/v1/index/repositories — list all indexed repos
DELETE /api/v1/index/repository/{repo_id} — remove repo + vectors
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import JSONResponse

from ai_client import ai
from cache_client import cache
from config import settings
from database_client import db
from models.schemas import (
    IndexRepositoryRequest,
    IndexRepositoryResponse,
    IndexStatusResponse,
)
from parser.embedder import embedder
from parser.git_analyzer import GitAnalyzer
from parser.tree_sitter_parser import CodeParser
from vector_client import vector

router = APIRouter()
logger = logging.getLogger("astramind.routers.index")


# ══════════════════════════════════════════════════════════════════════════════
# Background indexing task
# ══════════════════════════════════════════════════════════════════════════════

async def _run_indexing(repo_id: str, repo_path: str, repo_name: str, github_user: Optional[str] = None) -> None:
    """
    Full indexing pipeline — runs in background via asyncio.create_task().
    Steps:
      1. Walk all source files
      2. Parse + chunk each file via Tree-sitter
      3. Embed chunks in batches
      4. Upsert to vector store
      5. Save file metadata to DB
      6. Update repo record with final stats
    Progress is persisted to cache every file so the status endpoint stays current.
    """
    logger.info("[INDEX] Starting indexing for repo_id=%s path=%s", repo_id, repo_path)

    progress: Dict[str, Any] = {
        "repo_id": repo_id,
        "status": "running",
        "percent": 0.0,
        "files_done": 0,
        "total_files": 0,
        "message": "Scanning repository...",
        "error": None,
    }
    await cache.set_progress(repo_id, progress)

    try:
        # ── Step 1: collect all indexable files ───────────────────────────────
        file_list: List[tuple] = list(
            CodeParser.walk_repo(repo_path, settings.MAX_FILE_SIZE_KB)
        )
        total_files = len(file_list)
        progress["total_files"] = total_files
        progress["message"] = f"Found {total_files} files. Indexing..."
        await cache.set_progress(repo_id, progress)

        if total_files == 0:
            progress["status"] = "completed"
            progress["percent"] = 100.0
            progress["message"] = "No indexable source files found."
            await cache.set_progress(repo_id, progress)
            await db.save_repository({
                "id": repo_id,
                "name": repo_name,
                "repo_path": repo_path,
                "github_user": github_user,
                "language_summary": {},
                "total_files": 0,
                "total_functions": 0,
            })
            return

        # ── Save stub repo record FIRST so FK in indexed_files is satisfied ──
        await db.save_repository({
            "id": repo_id,
            "name": repo_name,
            "repo_path": repo_path,
            "github_user": github_user,
            "language_summary": {},
            "total_files": total_files,
            "total_functions": 0,
        })

        # Ensure vector collection exists
        vector.create_collection(repo_id)

        # ── Step 2-4: process files ───────────────────────────────────────────
        language_counts: Dict[str, int] = {}
        total_functions = 0
        EMBED_BATCH = 32  # embed N chunks at a time

        for file_index, (abs_path, rel_path, language) in enumerate(file_list):
            try:
                content = CodeParser.read_file(abs_path)
                if not content or not content.strip():
                    continue

                # Parse functions (for metadata + function_count)
                functions = CodeParser.parse_functions(content, language, rel_path)
                function_count = len(functions)
                total_functions += function_count

                # Chunk file
                chunks = CodeParser.chunk_text(
                    content, rel_path, language, repo_id
                )

                # Tag chunks with function name if function boundary is known
                func_by_line: Dict[int, str] = {
                    f.start_line: f.name for f in functions
                }
                for chunk in chunks:
                    # Find closest function start above chunk start
                    nearest = ""
                    for fl in sorted(func_by_line, reverse=True):
                        if fl <= chunk["start_line"]:
                            nearest = func_by_line[fl]
                            break
                    chunk["function_name"] = nearest

                # Embed in sub-batches
                for batch_start in range(0, len(chunks), EMBED_BATCH):
                    batch = chunks[batch_start : batch_start + EMBED_BATCH]
                    texts = [c["content"] for c in batch]
                    # Run blocking embedding in thread pool (it's CPU-bound)
                    loop = asyncio.get_event_loop()
                    embeddings = await loop.run_in_executor(
                        None, embedder.embed_batch, texts
                    )
                    for chunk, emb in zip(batch, embeddings):
                        chunk["embedding"] = emb

                # Upsert to vector store (blocking I/O — wrap in executor)
                await asyncio.get_event_loop().run_in_executor(
                    None, vector.upsert_chunks, repo_id, chunks
                )

                # Save file metadata
                last_modified: Optional[datetime] = None
                try:
                    mtime = os.path.getmtime(abs_path)
                    last_modified = datetime.fromtimestamp(mtime)
                except OSError:
                    pass

                await db.save_indexed_file({
                    "repo_id": repo_id,
                    "file_path": rel_path,
                    "language": language,
                    "function_count": function_count,
                    "chunk_count": len(chunks),
                    "last_modified": last_modified,
                })

                language_counts[language] = language_counts.get(language, 0) + 1

            except Exception as file_exc:
                logger.warning(
                    "[INDEX] Error indexing file %s: %s", rel_path, file_exc
                )
                # Continue with next file — don't abort entire job

            finally:
                done = file_index + 1
                progress["files_done"] = done
                progress["percent"] = round(done / total_files * 100, 1)
                progress["message"] = f"Indexed {done}/{total_files}: {rel_path}"
                await cache.set_progress(repo_id, progress)

        # ── Step 5: finalise repo record ──────────────────────────────────────
        await db.save_repository({
            "id": repo_id,
            "name": repo_name,
            "repo_path": repo_path,
            "github_user": github_user,
            "language_summary": language_counts,
            "total_files": total_files,
            "total_functions": total_functions,
        })

        progress["status"] = "completed"
        progress["percent"] = 100.0
        progress["message"] = (
            f"Indexing complete. {total_files} files, {total_functions} functions."
        )
        await cache.set_progress(repo_id, progress)
        logger.info(
            "[INDEX] Done repo_id=%s files=%d functions=%d",
            repo_id,
            total_files,
            total_functions,
        )

    except Exception as exc:
        logger.error("[INDEX] Fatal error for repo_id=%s: %s", repo_id, exc, exc_info=True)
        progress["status"] = "failed"
        progress["error"] = str(exc)
        progress["message"] = "Indexing failed. See error field."
        await cache.set_progress(repo_id, progress)

    finally:
        # ── Disk cleanup: remove cloned repo after indexing to preserve server disk space ──
        # The raw source files are no longer needed — all intelligence lives in the vector DB.
        cloned_path = os.path.join(settings.REPOS_STORAGE_PATH, repo_id)
        if os.path.isdir(cloned_path):
            try:
                shutil.rmtree(cloned_path)
                logger.info("[INDEX] Cleaned up cloned repo at %s", cloned_path)
            except Exception as cleanup_exc:
                logger.warning("[INDEX] Failed to clean up repo path %s: %s", cloned_path, cleanup_exc)


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/index/repository",
    response_model=IndexRepositoryResponse,
    summary="Start indexing a repository",
)
async def index_repository(request: IndexRepositoryRequest) -> IndexRepositoryResponse:
    """
    Kick off background indexing for a local path or GitHub URL.
    Returns immediately with a repo_id and status_url — poll the status endpoint.
    """
    logger.info(
        "[INDEX] Request: repo_name=%s github_url=%s path=%s",
        request.repo_name,
        request.github_url,
        request.repo_path,
    )

    if not request.repo_path and not request.github_url:
        raise HTTPException(
            status_code=422,
            detail="Either repo_path or github_url must be provided.",
        )

    repo_id = str(uuid.uuid4())

    # Determine local path
    if request.github_url:
        dest_path = os.path.join(settings.REPOS_STORAGE_PATH, repo_id)
        try:
            # Clone runs in thread pool (blocking network I/O)
            loop = asyncio.get_event_loop()
            repo_path = await loop.run_in_executor(
                None, GitAnalyzer.clone, request.github_url, dest_path
            )
        except Exception as exc:
            logger.error("[INDEX] Clone failed for %s: %s", request.github_url, exc)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to clone repository: {exc}",
            )
    else:
        repo_path = request.repo_path
        if not os.path.isdir(repo_path):
            raise HTTPException(
                status_code=404,
                detail=f"repo_path does not exist or is not a directory: {repo_path}",
            )

    # Set initial progress before launching task
    await cache.set_progress(
        repo_id,
        {
            "repo_id": repo_id,
            "status": "pending",
            "percent": 0.0,
            "files_done": 0,
            "total_files": 0,
            "message": "Job queued.",
            "error": None,
        },
    )

    # Launch background indexing (non-blocking)
    asyncio.create_task(
        _run_indexing(repo_id, repo_path, request.repo_name, getattr(request, 'github_user', None))
    )

    logger.info("[INDEX] Job launched: repo_id=%s", repo_id)
    return IndexRepositoryResponse(
        repo_id=repo_id,
        message="Indexing started. Poll status_url for progress.",
        status_url=f"/api/v1/index/status/{repo_id}",
    )


@router.get(
    "/index/status/{repo_id}",
    response_model=IndexStatusResponse,
    summary="Poll indexing progress",
)
async def get_index_status(repo_id: str) -> IndexStatusResponse:
    """Return current indexing progress for a repository."""
    logger.info("[INDEX] Status poll: repo_id=%s", repo_id)

    progress = await cache.get_progress(repo_id)
    if progress is None:
        raise HTTPException(
            status_code=404,
            detail=f"No indexing job found for repo_id={repo_id}. "
                   "Job may have expired (24h TTL) or never started.",
        )

    return IndexStatusResponse(
        repo_id=repo_id,
        status=progress.get("status", "unknown"),
        percent=float(progress.get("percent", 0)),
        files_done=int(progress.get("files_done", 0)),
        total_files=int(progress.get("total_files", 0)),
        message=progress.get("message"),
        error=progress.get("error"),
    )


@router.get(
    "/index/repositories",
    summary="List indexed repositories (filtered by github_user if provided)",
)
async def list_repositories(github_user: Optional[str] = Query(default=None)):
    """Return repository records. Pass ?github_user=login to filter by account."""
    logger.info("[INDEX] Listing repositories for github_user=%s", github_user)
    try:
        repos = await db.list_repositories(github_user=github_user)
        return {"repositories": repos, "total": len(repos)}
    except Exception as exc:
        logger.error("[INDEX] list_repositories failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/index/repository/{repo_id}",
    summary="Get a single repository record",
)
async def get_repository(repo_id: str):
    """Return metadata for a single indexed repository."""
    logger.info("[INDEX] Get repository: repo_id=%s", repo_id)
    try:
        repo = await db.get_repository(repo_id)
        if repo is None:
            raise HTTPException(status_code=404, detail=f"Repository {repo_id} not found.")
        return repo
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[INDEX] get_repository failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete(
    "/index/repository/{repo_id}",
    summary="Delete a repository and all its vectors",
)
async def delete_repository(repo_id: str):
    """
    Remove the vector collection, database records, and cloned repo files for a repo.
    """
    logger.info("[INDEX] Delete repository: repo_id=%s", repo_id)
    errors: List[str] = []

    # 1. Delete vector collection
    try:
        await asyncio.get_event_loop().run_in_executor(
            None, vector.delete_collection, repo_id
        )
    except Exception as exc:
        errors.append(f"Vector deletion failed: {exc}")

    # 2. Delete cloned repo directory if it lives in our REPOS_STORAGE_PATH
    repo_info = await db.get_repository(repo_id)
    if repo_info:
        repo_path = repo_info.get("repo_path", "")
        storage_base = os.path.abspath(settings.REPOS_STORAGE_PATH)
        abs_repo_path = os.path.abspath(repo_path)
        if abs_repo_path.startswith(storage_base) and os.path.isdir(abs_repo_path):
            import shutil
            try:
                shutil.rmtree(abs_repo_path, ignore_errors=True)
            except Exception as exc:
                errors.append(f"Directory deletion failed: {exc}")

    # 3. Delete from cache
    try:
        await cache.delete(f"progress:{repo_id}")
    except Exception:
        pass

    logger.info("[INDEX] Repository %s deleted. Errors: %s", repo_id, errors)
    return {
        "repo_id": repo_id,
        "deleted": True,
        "warnings": errors,
    }
