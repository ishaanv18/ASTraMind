"""
routers/timemachine.py — Code Time Machine (Advanced Feature 1)
POST /api/v1/timemachine/query — answer a question against historical + current codebase
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import tempfile
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ai_client import ai, sse_generator
from database_client import db
from models.schemas import TimeMachineRequest, TimeMachineResponse
from parser.embedder import embedder
from parser.git_analyzer import GitAnalyzer
from parser.tree_sitter_parser import CodeParser
from vector_client import vector

router = APIRouter()
logger = logging.getLogger("astramind.routers.timemachine")


HISTORICAL_QA_SYSTEM = (
    "You are an expert software engineer answering questions about a codebase "
    "at a specific point in time. Use only the code context provided. "
    "Be specific: cite file names, function names, and line numbers. "
    "If you cannot find the answer in the provided context, say so clearly."
)

CURRENT_QA_SYSTEM = (
    "You are an expert software engineer answering questions about the current "
    "state of a codebase. Use only the code context provided. "
    "Be specific: cite file names, function names, and line numbers. "
    "If you cannot find the answer in the provided context, say so clearly."
)

DIFF_SUMMARY_SYSTEM = (
    "You are a senior engineer explaining how a codebase evolved over time. "
    "You have two answers to the same question — one from a historical snapshot "
    "and one from the current codebase. Summarise:\n\n"
    "## What Changed\n"
    "Key differences between then and now (bullet list).\n\n"
    "## Why It Likely Changed\n"
    "Infer the business/technical reasons for the evolution.\n\n"
    "## Impact\n"
    "How does the change affect users, developers, or system behaviour?\n\n"
    "## Migration Notes\n"
    "If there is API/interface change: what callers need to update."
)


async def _index_snapshot(
    snapshot_path: str,
    collection_name: str,
) -> int:
    """
    Index a historical repo snapshot into a temporary vector collection.
    Returns the total number of chunks indexed.
    """
    logger.info("[TIMEMACHINE] Indexing snapshot at %s into %s", snapshot_path, collection_name)

    loop = asyncio.get_event_loop()

    # Create a temporary collection for this snapshot
    # We use the collection_name directly (not repo_{id} format)
    try:
        if vector._env == "production":
            from qdrant_client.models import Distance, VectorParams  # type: ignore
            try:
                vector._qdrant_client.get_collection(collection_name)
            except Exception:
                vector._qdrant_client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(size=384, distance=Distance.COSINE),
                )
        else:
            vector._chroma_client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"},
            )
    except Exception as exc:
        logger.warning("[TIMEMACHINE] Collection init error: %s", exc)

    EMBED_BATCH = 32
    total_chunks = 0

    for abs_path, rel_path, language in CodeParser.walk_repo(snapshot_path, max_file_size_kb=300):
        content = CodeParser.read_file(abs_path)
        if not content or not content.strip():
            continue

        # Use snapshot collection name as the fake repo_id for chunking UUIDs
        chunks = CodeParser.chunk_text(content, rel_path, language, collection_name)
        if not chunks:
            continue

        for batch_start in range(0, len(chunks), EMBED_BATCH):
            batch = chunks[batch_start : batch_start + EMBED_BATCH]
            texts = [c["content"] for c in batch]
            embeddings = await loop.run_in_executor(
                None, embedder.embed_batch, texts
            )
            for chunk, emb in zip(batch, embeddings):
                chunk["embedding"] = emb

        await loop.run_in_executor(
            None,
            lambda c=chunks: (
                vector._chroma_client.get_or_create_collection(
                    collection_name, metadata={"hnsw:space": "cosine"}
                ).upsert(
                    ids=[str(ch["id"]) for ch in c],
                    embeddings=[ch["embedding"] for ch in c],
                    documents=[ch["content"] for ch in c],
                    metadatas=[{
                        "file_path": ch["file_path"],
                        "language": ch.get("language", ""),
                        "function_name": ch.get("function_name", ""),
                        "chunk_index": ch.get("chunk_index", 0),
                    } for ch in c],
                )
                if vector._env != "production"
                else vector._qdrant_client.upsert(
                    collection_name=collection_name,
                    points=[
                        __import__("qdrant_client.models", fromlist=["PointStruct"]).PointStruct(
                            id=str(uuid.uuid5(uuid.NAMESPACE_DNS, ch["id"])),
                            vector=ch["embedding"],
                            payload={
                                "content": ch["content"],
                                "file_path": ch["file_path"],
                                "language": ch.get("language", ""),
                                "function_name": ch.get("function_name", ""),
                            },
                        )
                        for ch in c
                    ],
                )
            ),
        )

        total_chunks += len(chunks)

    logger.info("[TIMEMACHINE] Indexed %d chunks into %s", total_chunks, collection_name)
    return total_chunks


async def _query_snapshot(
    collection_name: str,
    query_embedding: List[float],
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    """Query a named vector collection (used for both historical and current)."""
    loop = asyncio.get_event_loop()

    if vector._env != "production":
        def _chroma_query():
            try:
                col = vector._chroma_client.get_collection(collection_name)
                count = col.count()
                if count == 0:
                    return []
                results = col.query(
                    query_embeddings=[query_embedding],
                    n_results=min(top_k, count),
                    include=["documents", "metadatas", "distances"],
                )
                items = []
                ids = results.get("ids", [[]])[0]
                docs = results.get("documents", [[]])[0]
                metas = results.get("metadatas", [[]])[0]
                dists = results.get("distances", [[]])[0]
                for doc, meta, dist in zip(docs, metas, dists):
                    items.append({
                        "content": doc,
                        "file_path": meta.get("file_path", ""),
                        "language": meta.get("language", ""),
                        "function_name": meta.get("function_name", ""),
                        "score": max(0.0, 1.0 - float(dist)),
                    })
                return items
            except Exception as exc:
                logger.warning("[TIMEMACHINE] Chroma query failed: %s", exc)
                return []

        return await loop.run_in_executor(None, _chroma_query)
    else:
        def _qdrant_query():
            try:
                results = vector._qdrant_client.search(
                    collection_name=collection_name,
                    query_vector=query_embedding,
                    limit=top_k,
                    with_payload=True,
                )
                return [
                    {
                        "content": r.payload.get("content", ""),
                        "file_path": r.payload.get("file_path", ""),
                        "language": r.payload.get("language", ""),
                        "function_name": r.payload.get("function_name", ""),
                        "score": float(r.score),
                    }
                    for r in results
                ]
            except Exception as exc:
                logger.warning("[TIMEMACHINE] Qdrant query failed: %s", exc)
                return []

        return await loop.run_in_executor(None, _qdrant_query)


def _chunks_to_context(chunks: List[Dict[str, Any]]) -> str:
    if not chunks:
        return "No relevant code found in this snapshot."
    parts = []
    for i, c in enumerate(chunks, 1):
        parts.append(
            f"[{i}] {c['file_path']}"
            + (f" ({c['function_name']})" if c.get("function_name") else "")
            + f"\n```{c.get('language', '')}\n{c['content']}\n```"
        )
    return "\n\n".join(parts)


# ══════════════════════════════════════════════════════════════════════════════
# Endpoint
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/timemachine/query",
    summary="Answer a question against a historical + current snapshot — diff streamed (SSE)",
)
async def timemachine_query(request: TimeMachineRequest):
    """
    1. Checks out the repo state at as_of_date in a temp directory
    2. Indexes the snapshot into a temporary vector collection
    3. Answers the question using historical context
    4. Answers the same question using current codebase
    5. Streams a diff_summary comparing both answers

    Returns JSON {historical_answer, current_answer} + SSE stream for diff_summary.
    Use the X-Historical-Answer and X-Current-Answer response headers for the pre-stream answers.
    """
    logger.info(
        "[TIMEMACHINE] repo_id=%s date=%s question=%r",
        request.repo_id,
        request.as_of_date,
        request.question[:80],
    )

    # Validate date format
    try:
        datetime.strptime(request.as_of_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"as_of_date must be YYYY-MM-DD format, got: {request.as_of_date}",
        )

    # Validate repo
    try:
        repo = await db.get_repository(request.repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

    repo_path = repo.get("repo_path", "")
    snapshot_collection = f"snapshot_{request.repo_id}_{request.as_of_date.replace('-', '')}"
    current_collection = f"repo_{request.repo_id}"

    loop = asyncio.get_event_loop()

    # Embed the question once
    try:
        query_embedding = await loop.run_in_executor(
            None, embedder.embed_query, request.question
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Embedding error: {exc}")

    # ── Historical snapshot ───────────────────────────────────────────────────
    temp_dir = tempfile.mkdtemp(prefix="astramind_tm_")
    historical_answer = "Could not retrieve historical answer."

    try:
        # Check if we've already indexed this snapshot (collection exists)
        snapshot_exists = False
        try:
            if vector._env != "production":
                existing = [c.name for c in vector._chroma_client.list_collections()]
                snapshot_exists = snapshot_collection in existing
            else:
                vector._qdrant_client.get_collection(snapshot_collection)
                snapshot_exists = True
        except Exception:
            snapshot_exists = False

        if not snapshot_exists:
            # Checkout historical snapshot
            try:
                snapshot_path = await loop.run_in_executor(
                    None,
                    GitAnalyzer.checkout_at_date,
                    repo_path,
                    request.as_of_date,
                    temp_dir,
                )
            except ValueError as exc:
                raise HTTPException(status_code=404, detail=str(exc))
            except Exception as exc:
                raise HTTPException(
                    status_code=500,
                    detail=f"Git checkout at {request.as_of_date} failed: {exc}",
                )

            # Index snapshot
            await _index_snapshot(snapshot_path, snapshot_collection)
        else:
            logger.info("[TIMEMACHINE] Reusing cached snapshot collection: %s", snapshot_collection)

        # Query historical snapshot
        hist_chunks = await _query_snapshot(snapshot_collection, query_embedding, top_k=10)
        hist_context = _chunks_to_context(hist_chunks)

        hist_user_prompt = (
            f"Question: {request.question}\n\n"
            f"Codebase state as of {request.as_of_date}:\n\n{hist_context}"
        )

        try:
            historical_answer = await ai.call_with_retry(
                HISTORICAL_QA_SYSTEM, hist_user_prompt, max_tokens=1024
            )
        except Exception as exc:
            historical_answer = f"AI call failed: {exc}"

    finally:
        # Clean up temp dir
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass

    # ── Current codebase ──────────────────────────────────────────────────────
    current_answer = "Could not retrieve current answer."
    try:
        curr_chunks = await _query_snapshot(current_collection, query_embedding, top_k=10)
        curr_context = _chunks_to_context(curr_chunks)

        curr_user_prompt = (
            f"Question: {request.question}\n\n"
            f"Current codebase context:\n\n{curr_context}"
        )

        try:
            current_answer = await ai.call_with_retry(
                CURRENT_QA_SYSTEM, curr_user_prompt, max_tokens=1024
            )
        except Exception as exc:
            current_answer = f"AI call failed: {exc}"
    except Exception as exc:
        logger.warning("[TIMEMACHINE] Current codebase query failed: %s", exc)

    # ── Stream diff summary ───────────────────────────────────────────────────
    diff_user_prompt = (
        f"## Question Asked\n{request.question}\n\n"
        f"## Historical Answer (as of {request.as_of_date})\n{historical_answer}\n\n"
        f"## Current Answer (today)\n{current_answer}\n\n"
        "Now provide the evolution summary."
    )

    logger.info("[TIMEMACHINE] Streaming diff summary.")

    # Encode both answers into response headers so the client gets them without parsing SSE
    import base64

    def _safe_header(val: str) -> str:
        """Base64-encode to avoid header injection from AI output."""
        return base64.b64encode(val[:500].encode()).decode()

    return StreamingResponse(
        sse_generator(DIFF_SUMMARY_SYSTEM, diff_user_prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Historical-Answer": _safe_header(historical_answer),
            "X-Current-Answer": _safe_header(current_answer),
            "X-As-Of-Date": request.as_of_date,
        },
    )
