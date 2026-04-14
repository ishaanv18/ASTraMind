"""
routers/review.py — Inline Code Review & Pair Programming Chat (Feature 10)
POST /api/v1/review/inline   — streaming line-by-line code review
POST /api/v1/review/chat     — persistent conversation-aware chat with SSE
GET  /api/v1/review/conversations/{repo_id}  — list conversations
DELETE /api/v1/review/conversation/{conv_id} — delete conversation
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from ai_client import ai
from database_client import db
from models.schemas import (
    ConversationsListResponse,
    ConversationSummary,
    InlineReviewRequest,
    ReviewChatRequest,
    ReviewChatResponse,
)
from parser.embedder import embedder
from vector_client import vector

router = APIRouter()
logger = logging.getLogger("astramind.routers.review")


# ── System prompts ────────────────────────────────────────────────────────────

INLINE_REVIEW_SYSTEM = (
    "Principal engineer doing a code review. Respond with:\n"
    "## Issues\n`[line N] [SEVERITY]` comment. SEVERITY: INFO|WARNING|ERROR|CRITICAL.\n\n"
    "## Scores\n| Readability | Correctness | Performance | Maintainability | (X/100 each)\n\n"
    "## Top Fix\nShow the single most important before/after code fix."
)

CHAT_SYSTEM = (
    "You are a senior software engineer conducting an expert code review session. "
    "You have deep knowledge of this codebase. "
    "Always cite specific file paths and line numbers when referencing code. "
    "Show complete functions, never partial snippets. "
    "Ask clarifying questions when the request is ambiguous. "
    "Be constructive, precise, and actionable."
)


# ══════════════════════════════════════════════════════════════════════════════
# Inline review
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/review/inline",
    summary="Streaming inline code review from a principal engineer (SSE)",
)
async def inline_review(request: InlineReviewRequest):
    """
    Reviews the submitted code snippet.
    Retrieves similar functions from vector store for context.
    Streams a structured review via SSE covering:
    line comments, performance, readability, error handling, and 4-dimension scores.
    """
    logger.info(
        "[REVIEW/INLINE] repo_id=%s file=%s cursor_line=%s code_len=%d",
        request.repo_id,
        request.file_path,
        request.cursor_line,
        len(request.code),
    )

    # Validate repo
    try:
        repo = await db.get_repository(request.repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

    # Retrieve similar functions for context
    similar_chunks: List[Dict[str, Any]] = []
    try:
        loop = asyncio.get_event_loop()
        query_embedding = await loop.run_in_executor(
            None, embedder.embed_query, request.code[:4000]
        )
        similar_chunks = await loop.run_in_executor(
            None,
            lambda: vector.query(request.repo_id, query_embedding, top_k=5),
        )
    except Exception as exc:
        logger.warning("[REVIEW/INLINE] Vector lookup failed (non-fatal): %s", exc)

    # Build context from similar functions
    context_str = ""
    if similar_chunks:
        parts = [
            f"[{i}] {c['file_path']}"
            + (f" ({c['function_name']})" if c.get("function_name") else "")
            + f"\n```{c.get('language', '')}\n{c['content']}\n```"
            for i, c in enumerate(similar_chunks, 1)
        ]
        context_str = (
            "\n\n## Similar Code From Codebase (for pattern reference):\n\n"
            + "\n\n".join(parts)
        )

    cursor_info = (
        f"Cursor is at line {request.cursor_line}. "
        if request.cursor_line
        else ""
    )

    user_prompt = (
        f"Review this code from `{request.file_path}`:\n\n"
        f"{cursor_info}\n"
        f"```{_detect_language_from_path(request.file_path)}\n"
        f"{request.code}\n"
        f"```"
        + context_str
    )

    logger.info("[REVIEW/INLINE] Calling AI. similar_chunks=%d", len(similar_chunks))

    try:
        review = await ai.call(INLINE_REVIEW_SYSTEM, user_prompt, max_tokens=600)
    except Exception as exc:
        review = f"Review failed: {exc}"

    return {"review": review, "context_chunks_used": len(similar_chunks)}


# ══════════════════════════════════════════════════════════════════════════════
# Persistent review chat
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/review/chat",
    response_model=ReviewChatResponse,
    summary="Initiate or continue a code review chat conversation",
)
async def review_chat(request: ReviewChatRequest):
    """
    Persistent, context-aware code review chat.
    Maintains full conversation history across turns.
    Retrieves relevant code chunks on each turn for grounded responses.
    Returns conversation_id + streams AI response via SSE on a separate call.
    """
    logger.info(
        "[REVIEW/CHAT] repo_id=%s conv_id=%s msg=%r",
        request.repo_id,
        request.conversation_id,
        request.message[:80],
    )

    # Validate repo
    try:
        repo = await db.get_repository(request.repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

    # Load or create conversation
    conv_id = request.conversation_id
    messages: List[Dict[str, Any]] = []

    if conv_id:
        try:
            conv = await db.get_conversation(conv_id)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Database error: {exc}")
        if conv is None:
            raise HTTPException(status_code=404, detail=f"Conversation {conv_id} not found.")
        messages = conv.get("messages", [])
    else:
        # New conversation
        conv_id = str(uuid.uuid4())
        try:
            await db.save_conversation({
                "id": conv_id,
                "repo_id": request.repo_id,
                "title": request.message[:60],
                "messages": [],
            })
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to create conversation: {exc}")

    # Append new user message
    user_msg = {
        "role": "user",
        "content": request.message,
        "timestamp": datetime.utcnow().isoformat(),
    }
    messages.append(user_msg)

    # Retrieve relevant code chunks
    relevant_context = ""
    try:
        loop = asyncio.get_event_loop()
        query_embedding = await loop.run_in_executor(
            None, embedder.embed_query, request.message[:4000]
        )
        chunks = await loop.run_in_executor(
            None,
            lambda: vector.query(request.repo_id, query_embedding, top_k=8),
        )
        if chunks:
            parts = [
                f"[{i}] {c['file_path']}"
                + (f" ({c['function_name']})" if c.get("function_name") else "")
                + f"\n```{c.get('language', '')}\n{c['content']}\n```"
                for i, c in enumerate(chunks, 1)
            ]
            relevant_context = "\n\n## Relevant Code Context:\n\n" + "\n\n".join(parts)
    except Exception as exc:
        logger.warning("[REVIEW/CHAT] Vector lookup failed (non-fatal): %s", exc)

    # Build message history for prompt (last 20 turns)
    history_text = ""
    if len(messages) > 1:
        history_parts = []
        for msg in messages[:-1][-20:]:  # last 20, excluding the current one
            role = msg["role"].upper()
            history_parts.append(f"[{role}]: {msg['content']}")
        history_text = "\n\n## Conversation History:\n\n" + "\n\n".join(history_parts)

    repo_name = repo.get("name", "this repository")
    user_prompt = (
        f"Repository: {repo_name}\n"
        + history_text
        + f"\n\n## Current Message:\n{request.message}"
        + relevant_context
    )

    # Stream response and collect it to save
    async def _stream_and_save():
        collected: List[str] = []
        try:
            async for chunk in ai.stream(CHAT_SYSTEM, user_prompt):
                collected.append(chunk)
                payload = json.dumps({"content": chunk, "conversation_id": conv_id})
                yield f"data: {payload}\n\n"
        except Exception as exc:
            error_payload = json.dumps({"error": str(exc)})
            yield f"data: {error_payload}\n\n"
        finally:
            # Save assistant reply to conversation
            assistant_reply = "".join(collected)
            assistant_msg = {
                "role": "assistant",
                "content": assistant_reply,
                "timestamp": datetime.utcnow().isoformat(),
            }
            messages.append(assistant_msg)
            try:
                await db.update_conversation(conv_id, messages)
            except Exception as save_exc:
                logger.error("[REVIEW/CHAT] Failed to save conversation: %s", save_exc)
            yield "data: [DONE]\n\n"

    logger.info(
        "[REVIEW/CHAT] Streaming response. conv_id=%s history_len=%d",
        conv_id,
        len(messages),
    )

    return StreamingResponse(
        _stream_and_save(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Conversation-Id": conv_id,
        },
    )


# ══════════════════════════════════════════════════════════════════════════════
# Conversation management
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/review/conversations/{repo_id}",
    response_model=ConversationsListResponse,
    summary="List all review conversations for a repository",
)
async def list_review_conversations(repo_id: str) -> ConversationsListResponse:
    """Return all review conversations for a repository, ordered by most recently updated."""
    logger.info("[REVIEW/CHAT] List conversations: repo_id=%s", repo_id)
    try:
        conversations = await db.list_conversations(repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    summaries = [
        ConversationSummary(
            id=c["id"],
            repo_id=c["repo_id"],
            title=c.get("title") or "Untitled",
            message_count=len(c.get("messages") or []),
            created_at=c.get("created_at") or "",
            updated_at=c.get("updated_at") or "",
        )
        for c in conversations
    ]

    return ConversationsListResponse(
        repo_id=repo_id,
        conversations=summaries,
        total=len(summaries),
    )


@router.delete(
    "/review/conversation/{conv_id}",
    summary="Delete a review conversation",
)
async def delete_review_conversation(conv_id: str):
    """Permanently delete a code review conversation and its history."""
    logger.info("[REVIEW/CHAT] Delete conversation: conv_id=%s", conv_id)
    try:
        conv = await db.get_conversation(conv_id)
        if conv is None:
            raise HTTPException(status_code=404, detail=f"Conversation {conv_id} not found.")
        await db.delete_conversation(conv_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    return {"conv_id": conv_id, "deleted": True}


@router.get(
    "/review/conversation/{conv_id}",
    summary="Get a single conversation with full message history",
)
async def get_review_conversation(conv_id: str):
    """Return a conversation record including all messages."""
    logger.info("[REVIEW/CHAT] Get conversation: conv_id=%s", conv_id)
    try:
        conv = await db.get_conversation(conv_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if conv is None:
        raise HTTPException(status_code=404, detail=f"Conversation {conv_id} not found.")
    return conv


# ── Utility ───────────────────────────────────────────────────────────────────

def _detect_language_from_path(file_path: str) -> str:
    """Return a language string for syntax highlighting from file extension."""
    from pathlib import Path
    from parser.tree_sitter_parser import EXTENSION_TO_LANGUAGE
    suffix = Path(file_path).suffix.lower()
    return EXTENSION_TO_LANGUAGE.get(suffix, "")
