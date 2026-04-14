"""
routers/pair.py — Pair Programming Chat (Advanced Feature 5)
POST /api/v1/pair/chat                       — persistent AI pair programmer (SSE)
GET  /api/v1/pair/conversations/{repo_id}    — list all pair chats
DELETE /api/v1/pair/conversations/{conv_id}  — delete a conversation
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
    PairChatRequest,
    PairChatResponse,
)
from parser.embedder import embedder
from parser.git_analyzer import GitAnalyzer
from vector_client import vector

router = APIRouter()
logger = logging.getLogger("astramind.routers.pair")


PAIR_SYSTEM_TEMPLATE = (
    "You are a senior software engineer pair programming on '{repo_name}' ({languages}).\n"
    "Rules: cite file paths; show COMPLETE code; finish every response with a complete sentence.\n\n"
    "Codebase context:\n{repo_context}"
)


async def _build_pair_context(
    repo_id: str,
    repo_path: str,
    message: str,
    language_summary: Dict[str, int],
) -> tuple[str, List[Dict[str, Any]]]:
    """
    Embed the current message, retrieve top-10 relevant chunks.
    Returns (context_string, chunks).
    """
    loop = asyncio.get_event_loop()
    chunks: List[Dict[str, Any]] = []

    try:
        query_embedding = await loop.run_in_executor(
            None, embedder.embed_query, message[:4000]
        )
        chunks = await loop.run_in_executor(
            None,
            lambda: vector.query(repo_id, query_embedding, top_k=10),
        )
    except Exception as exc:
        logger.warning("[PAIR] Vector lookup failed (non-fatal): %s", exc)

    # Build directory tree (short version)
    dir_tree = ""
    try:
        dir_tree = await loop.run_in_executor(
            None, GitAnalyzer.get_directory_tree, repo_path, 2
        )
        dir_tree = dir_tree[:1000]  # keep it brief
    except Exception:
        pass

    lang_str = ", ".join(
        f"{lang}" for lang in list(language_summary.keys())[:6]
    )

    # Build code context from retrieved chunks
    code_context_parts: List[str] = []
    if chunks:
        for i, c in enumerate(chunks, 1):
            code_context_parts.append(
                f"[{i}] `{c['file_path']}`"
                + (f" — {c['function_name']}" if c.get("function_name") else "")
                + f"\n```{c.get('language', '')}\n{c['content'][:600]}\n```"
            )

    context_parts = []
    if dir_tree:
        context_parts.append(f"Directory structure:\n```\n{dir_tree}\n```")
    if code_context_parts:
        context_parts.append(
            "Relevant code (retrieved by semantic search):\n\n"
            + "\n\n".join(code_context_parts)
        )

    full_context = "\n\n".join(context_parts) if context_parts else "No codebase context available."
    return full_context, chunks


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/pair/chat",
    summary="Pair programming chat with a senior engineer AI (SSE)",
)
async def pair_chat(request: PairChatRequest):
    """
    Persistent, context-aware pair programming session.
    On the first call (no conversation_id), a new conversation is created.
    Subsequent calls continue the same session.

    The AI:
    - Always cites file paths and line numbers
    - Shows complete functions
    - Asks clarifying questions when ambiguous
    - Maintains context across turns (last 20 messages)
    - Retrieves relevant code via semantic search on each turn

    Response: SSE stream. Check X-Conversation-Id header for the conversation ID.
    """
    logger.info(
        "[PAIR] chat: repo_id=%s conv_id=%s msg=%r",
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

    repo_path = repo.get("repo_path", "")
    repo_name = repo.get("name", "this repository")
    language_summary = repo.get("language_summary", {})

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
        messages = conv.get("messages", []) or []
    else:
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

    # Append user message
    user_msg = {
        "role": "user",
        "content": request.message,
        "timestamp": datetime.utcnow().isoformat(),
    }
    messages.append(user_msg)

    # Build codebase context and retrieve relevant chunks
    try:
        repo_context, chunks = await _build_pair_context(
            request.repo_id, repo_path, request.message, language_summary
        )
    except Exception as exc:
        logger.warning("[PAIR] Context build failed: %s", exc)
        repo_context = "Codebase context unavailable."
        chunks = []

    # Build system prompt with repo context
    lang_str = ", ".join(language_summary.keys()) or "mixed"
    system_prompt = PAIR_SYSTEM_TEMPLATE.format(
        repo_name=repo_name,
        languages=lang_str,
        repo_context=repo_context,
    )

    # Build conversation history for prompt (last 20 turns)
    history_turns: List[Dict[str, str]] = []
    for msg in messages[:-1][-20:]:
        role = msg.get("role", "user")
        if role in ("user", "assistant"):
            history_turns.append({
                "role": role,
                "content": msg.get("content", ""),
            })

    # Format history as readable text for the prompt
    history_text = ""
    if history_turns:
        parts = []
        for turn in history_turns:
            label = "You" if turn["role"] == "user" else "Assistant"
            parts.append(f"**{label}**: {turn['content'][:400]}")
        history_text = "\n\n## Conversation History\n\n" + "\n\n".join(parts)

    user_prompt = (
        history_text
        + f"\n\n## Current Request\n{request.message}"
    )

    logger.info("[PAIR] Calling AI. conv_id=%s history=%d chunks=%d", conv_id, len(history_turns), len(chunks))
    try:
        reply = await ai.call(system_prompt, user_prompt, max_tokens=768)
    except Exception as exc:
        logger.error("[PAIR] AI error: %s", exc)
        reply = f"AI error: {exc}"

    # Persist assistant reply
    if reply:
        messages.append({
            "role": "assistant",
            "content": reply,
            "timestamp": datetime.utcnow().isoformat(),
        })
        try:
            await db.update_conversation(conv_id, messages)
        except Exception as save_exc:
            logger.error("[PAIR] Save failed: %s", save_exc)

    logger.info("[PAIR] Done. len=%d", len(reply))
    return {"reply": reply, "conversation_id": conv_id}


@router.get(
    "/pair/conversations/{repo_id}",
    response_model=ConversationsListResponse,
    summary="List all pair programming conversations for a repository",
)
async def list_pair_conversations(repo_id: str) -> ConversationsListResponse:
    """Return all pair programming conversations for a repository."""
    logger.info("[PAIR] List conversations: repo_id=%s", repo_id)

    try:
        repo = await db.get_repository(repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {repo_id} not found.")

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
    "/pair/conversations/{conv_id}",
    summary="Delete a pair programming conversation",
)
async def delete_pair_conversation(conv_id: str):
    """Permanently delete a pair programming conversation and its history."""
    logger.info("[PAIR] Delete conversation: conv_id=%s", conv_id)
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
    "/pair/conversation/{conv_id}",
    summary="Get a pair chat conversation with full history",
)
async def get_pair_conversation(conv_id: str):
    """Return a conversation with all messages."""
    try:
        conv = await db.get_conversation(conv_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if conv is None:
        raise HTTPException(status_code=404, detail=f"Conversation {conv_id} not found.")
    return conv
