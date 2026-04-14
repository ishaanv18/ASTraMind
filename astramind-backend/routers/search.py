"""
routers/search.py — Semantic Search & Codebase Q&A (Feature 2)
GET  /api/v1/search      — vector similarity search across a repo
POST /api/v1/ask         — RAG Q&A, returns plain JSON {"answer": "..."}
"""

from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from ai_client import ai
from database_client import db
from models.schemas import AskRequest, SearchResponse, SearchResultItem
from parser.embedder import embedder
from vector_client import vector

router = APIRouter()
logger = logging.getLogger("astramind.routers.search")


# ══════════════════════════════════════════════════════════════════════════════
# Semantic Search
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/search",
    response_model=SearchResponse,
    summary="Semantic search across an indexed repository",
)
async def semantic_search(
    query: str = Query(..., description="Natural language or code snippet to search for"),
    repo_id: str = Query(..., description="Repository ID to search within"),
    top_k: int = Query(default=10, ge=1, le=50, description="Number of results to return"),
    language: Optional[str] = Query(default=None, description="Filter by language, e.g. python"),
) -> SearchResponse:
    """
    Embed the query with all-MiniLM-L6-v2 then run cosine similarity search
    against the repo's vector collection.
    """
    logger.info("[SEARCH] query=%r repo_id=%s top_k=%d language=%s", query[:80], repo_id, top_k, language)

    try:
        repo = await db.get_repository(repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {repo_id} not found.")

    try:
        exists = await asyncio.get_event_loop().run_in_executor(None, vector.collection_exists, repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Vector store error: {exc}")

    if not exists:
        raise HTTPException(status_code=404, detail=f"Vector collection for repo {repo_id} not found.")

    try:
        loop = asyncio.get_event_loop()
        query_embedding: List[float] = await loop.run_in_executor(None, embedder.embed_query, query)
    except Exception as exc:
        logger.error("[SEARCH] Embedding failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Embedding error: {exc}")

    try:
        raw_results = await asyncio.get_event_loop().run_in_executor(
            None, lambda: vector.query(repo_id, query_embedding, top_k, language)
        )
    except Exception as exc:
        logger.error("[SEARCH] Vector query failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Vector search error: {exc}")

    results = [
        SearchResultItem(
            file_path=r["file_path"],
            function_name=r.get("function_name") or None,
            content=r["content"],
            score=round(r["score"], 4),
            language=r.get("language") or None,
        )
        for r in raw_results
    ]

    logger.info("[SEARCH] Returned %d results for query=%r", len(results), query[:40])
    return SearchResponse(query=query, repo_id=repo_id, results=results, total=len(results))


# ══════════════════════════════════════════════════════════════════════════════
# Codebase Q&A (RAG — plain JSON, no SSE)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/ask", summary="Ask a natural language question about an indexed codebase")
async def ask_codebase(request: AskRequest):
    """
    RAG Q&A: embeds question → retrieves top-5 code chunks → calls AI → returns JSON.
    Response: {"answer": "..."}
    """
    logger.info("[ASK] question=%r repo_id=%s", request.question[:100], request.repo_id)

    try:
        repo = await db.get_repository(request.repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

    try:
        loop = asyncio.get_event_loop()
        query_embedding = await loop.run_in_executor(None, embedder.embed_query, request.question)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Embedding error: {exc}")

    try:
        chunks = await asyncio.get_event_loop().run_in_executor(
            None, lambda: vector.query(request.repo_id, query_embedding, top_k=5)
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Vector search error: {exc}")

    if not chunks:
        return {"answer": "No relevant code found for your question. Make sure indexing is complete."}

    # Build compact context (400 chars per chunk max)
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        preview = chunk["content"][:400] + ("..." if len(chunk["content"]) > 400 else "")
        context_parts.append(
            f"[{i}] {chunk['file_path']}"
            + (f" ({chunk['function_name']})" if chunk.get("function_name") else "")
            + f"\n{preview}"
        )
    context = "\n\n".join(context_parts)
    repo_name = repo.get("name", "this codebase")

    system_prompt = (
        f"You are a code expert for '{repo_name}'. "
        "Answer concisely using only the provided code context. Cite file paths. "
        "Keep the answer under 200 words and always write a complete sentence at the end."
    )
    user_prompt = (
        f"Question: {request.question}\n\n"
        f"Code context:\n{context}\n\n"
        "Answer:"
    )

    logger.info("[ASK] Calling AI. chunks=%d", len(chunks))
    try:
        answer = await ai.call(system_prompt, user_prompt, max_tokens=512)
    except Exception as exc:
        logger.error("[ASK] AI error: %s", exc)
        return {"answer": f"AI error: {exc}"}

    logger.info("[ASK] Done. len=%d", len(answer))
    return {"answer": answer}
