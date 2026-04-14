"""
routers/debug.py — Multi-Agent Debugging (Feature 3)
POST /api/v1/debug/analyze  — 3 specialist agents + streaming synthesis
POST /api/v1/debug/stream-synthesis — SSE stream for synthesis agent
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException

from ai_client import ai
from config import settings
from database_client import db
from models.schemas import DebugAnalyzeRequest, DebugAnalyzeResponse
from parser.embedder import embedder
from vector_client import vector

router = APIRouter()
logger = logging.getLogger("astramind.routers.debug")

# ── Agent system prompts ──────────────────────────────────────────────────────

AGENT_1_SYSTEM = (
    "You are a logic error specialist code debugger. "
    "Only analyze for: wrong conditions, off-by-one errors, incorrect algorithms, "
    "bad data transformations, incorrect loop bounds, wrong comparisons, and "
    "flawed business logic. "
    "Be precise and brief. Format: bullet points with line references where possible."
)

AGENT_2_SYSTEM = (
    "You are a runtime error specialist code debugger. "
    "Only analyze for: null/None references, type errors, unhandled exceptions, "
    "memory issues, async race conditions, promise rejections, deadlocks, "
    "stack overflows, and resource leaks. "
    "Be precise and brief. Format: bullet points with line references where possible."
)

AGENT_3_SYSTEM = (
    "You are a configuration and environment specialist code debugger. "
    "Only analyze for: missing environment variables, wrong import paths, "
    "version conflicts, missing dependencies, incorrect file paths, "
    "misconfigured settings, CORS issues, missing API keys, and "
    "deployment environment mismatches. "
    "Be precise and brief. Format: bullet points with line references where possible."
)

SYNTHESIS_SYSTEM = (
    "You are a senior staff engineer conducting a final debugging analysis. "
    "You have received analyses from three specialist debugging agents. "
    "Synthesize them into a definitive debugging report with these exact sections:\n\n"
    "## 1. Most Likely Root Cause\n"
    "State the single most probable cause with confidence percentage (0-100%).\n\n"
    "## 2. Evidence Summary\n"
    "Which agent findings support this conclusion and why.\n\n"
    "## 3. Exact Code Fix\n"
    "Show the BEFORE code and the AFTER fixed code. Use diff format:\n"
    "```diff\n- old line\n+ new line\n```\n\n"
    "## 4. Reproducing Unit Test\n"
    "Write a minimal unit test (pytest for Python, Jest for JS) that reproduces "
    "the bug and passes after the fix is applied.\n\n"
    "## 5. Prevention\n"
    "One sentence on how to prevent this class of bug in future."
)


async def _build_debug_prompt(
    error_message: str,
    stack_trace: str,
    repo_id: str,
    affected_file: Optional[str],
) -> tuple[str, List[Dict[str, Any]]]:
    """
    Embed the error message, retrieve top-10 relevant code chunks,
    and build the shared user prompt handed to all three specialist agents.
    Returns (user_prompt, chunks).
    """
    # Embed error+stacktrace as the query
    query_text = f"{error_message}\n{stack_trace or ''}"
    loop = asyncio.get_event_loop()
    embedding = await loop.run_in_executor(
        None, embedder.embed_query, query_text[:4000]
    )

    # Retrieve relevant chunks
    chunks: List[Dict[str, Any]] = []
    if repo_id:
        try:
            chunks = await loop.run_in_executor(
                None,
                lambda: vector.query(repo_id, embedding, top_k=10),
            )
        except Exception as exc:
            logger.warning("[DEBUG] Vector query failed: %s", exc)

    # Build code context
    code_context = ""
    if chunks:
        parts = []
        for i, chunk in enumerate(chunks, 1):
            parts.append(
                f"[{i}] {chunk['file_path']}"
                + (f" ({chunk['function_name']})" if chunk.get("function_name") else "")
                + f"\n```{chunk.get('language', '')}\n{chunk['content']}\n```"
            )
        code_context = "\n\n".join(parts)

    user_prompt = (
        f"## Error\n{error_message}\n\n"
        + (f"## Stack Trace\n```\n{stack_trace}\n```\n\n" if stack_trace else "")
        + (f"## Affected File\n{affected_file}\n\n" if affected_file else "")
        + (f"## Relevant Code from Codebase\n\n{code_context}" if code_context else "")
    )

    return user_prompt, chunks


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/debug/analyze",
    summary="Multi-agent debug analysis (3 specialists + streaming synthesis)",
)
async def debug_analyze(request: DebugAnalyzeRequest):
    """
    Runs three specialist AI agents in parallel (asyncio.gather), then streams
    a synthesis from a fourth senior-engineer agent.

    Response format:
    {
      "agent_1_logic": "...",
      "agent_2_runtime": "...",
      "agent_3_config": "...",
      "synthesis_stream_url": "/api/v1/debug/stream-synthesis"
    }

    After receiving this JSON, the frontend should POST to synthesis_stream_url
    with the same request body to get the streaming synthesis.
    """
    logger.info(
        "[DEBUG] analyze: error=%r repo_id=%s file=%s",
        request.error_message[:80],
        request.repo_id,
        request.affected_file,
    )

    # Validate repo exists if repo_id provided
    if request.repo_id:
        try:
            repo = await db.get_repository(request.repo_id)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Database error: {exc}")
        if repo is None:
            raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

    # Build shared prompt
    try:
        user_prompt, chunks = await _build_debug_prompt(
            request.error_message,
            request.stack_trace or "",
            request.repo_id,
            request.affected_file,
        )
    except Exception as exc:
        logger.error("[DEBUG] Prompt build failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to build debug context: {exc}")

    # Run all 3 agents in parallel
    logger.info("[DEBUG] Launching 3 specialist agents in parallel...")
    try:
        agent_1_result, agent_2_result, agent_3_result = await asyncio.gather(
            ai.call_with_retry(AGENT_1_SYSTEM, user_prompt, max_tokens=1024),
            ai.call_with_retry(AGENT_2_SYSTEM, user_prompt, max_tokens=1024),
            ai.call_with_retry(AGENT_3_SYSTEM, user_prompt, max_tokens=1024),
        )
    except Exception as exc:
        logger.error("[DEBUG] Agent parallel call failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"AI agent call failed: {exc}",
        )

    logger.info("[DEBUG] 3 agents complete. Synthesis ready to stream.")

    return {
        "repo_id": request.repo_id,
        "error_message": request.error_message,
        "agent_1_logic": agent_1_result,
        "agent_2_runtime": agent_2_result,
        "agent_3_config": agent_3_result,
        "synthesis_stream_url": "/api/v1/debug/stream-synthesis",
        "chunks_used": len(chunks),
    }


@router.post(
    "/debug/stream-synthesis",
    summary="Stream the synthesis agent's final root-cause analysis (SSE)",
    response_description="SSE stream: data: {content: '...'} ... data: [DONE]",
)
async def stream_synthesis(request: DebugAnalyzeRequest):
    """
    Call this after /debug/analyze to stream the fourth synthesis agent's output.
    Re-runs the three specialist agents (cached implicitly in the model) and
    synthesises into a single structured report streamed via SSE.

    This separation lets the frontend show the three agent panels immediately
    while the synthesis loads progressively.
    """
    logger.info(
        "[DEBUG] stream-synthesis: error=%r repo_id=%s",
        request.error_message[:80],
        request.repo_id,
    )

    # Build context (same as analyze)
    try:
        user_prompt, chunks = await _build_debug_prompt(
            request.error_message,
            request.stack_trace or "",
            request.repo_id,
            request.affected_file,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Context build failed: {exc}")

    # Run 3 agents again (fast path — production Groq is fast enough)
    try:
        a1, a2, a3 = await asyncio.gather(
            ai.call_with_retry(AGENT_1_SYSTEM, user_prompt, max_tokens=512),
            ai.call_with_retry(AGENT_2_SYSTEM, user_prompt, max_tokens=512),
            ai.call_with_retry(AGENT_3_SYSTEM, user_prompt, max_tokens=512),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Agent calls failed: {exc}")

    # Build synthesis prompt containing all three findings
    synthesis_user_prompt = (
        f"## Original Error\n{request.error_message}\n\n"
        + (f"## Stack Trace\n```\n{request.stack_trace}\n```\n\n" if request.stack_trace else "")
        + f"## Agent 1 — Logic Error Analysis\n{a1}\n\n"
        f"## Agent 2 — Runtime Error Analysis\n{a2}\n\n"
        f"## Agent 3 — Config/Environment Analysis\n{a3}\n\n"
        "Now synthesise these findings into your final report."
    )

    try:
        synthesis_result = await ai.call(SYNTHESIS_SYSTEM, synthesis_user_prompt, max_tokens=400)
    except Exception as exc:
        synthesis_result = f"Synthesis failed: {exc}"

    return {"synthesis": synthesis_result}


@router.post(
    "/debug/synthesize",
    summary="Synthesize 3 agent results into a final JSON root-cause report",
)
async def debug_synthesize(request: DebugAnalyzeRequest):
    """
    Called by frontend after /debug/analyze.
    Accepts agent_results in the body if provided, otherwise re-runs agents.
    """
    logger.info(
        "[DEBUG] synthesize: error=%r repo_id=%s",
        request.error_message[:80],
        request.repo_id,
    )

    # Use pre-computed agent results passed from the frontend if available
    a1 = getattr(request, "agent_1_logic", None) or ""
    a2 = getattr(request, "agent_2_runtime", None) or ""
    a3 = getattr(request, "agent_3_config", None) or ""

    # If not provided, run agents briefly
    if not (a1 or a2 or a3):
        try:
            user_prompt, _ = await _build_debug_prompt(
                request.error_message,
                request.stack_trace or "",
                request.repo_id or "",
                request.affected_file,
            )
            a1, a2, a3 = await asyncio.gather(
                ai.call(AGENT_1_SYSTEM, user_prompt, max_tokens=150),
                ai.call(AGENT_2_SYSTEM, user_prompt, max_tokens=150),
                ai.call(AGENT_3_SYSTEM, user_prompt, max_tokens=150),
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Agent calls failed: {exc}")

    short_synthesis_system = (
        "Senior engineer. Given 3 agent analyses of a bug, state: "
        "1) root cause (1 sentence), 2) code fix (diff format), 3) prevention tip. "
        "Under 120 words total."
    )
    synthesis_prompt = (
        f"Error: {request.error_message}\n"
        + (f"Stack: {(request.stack_trace or '')[:300]}\n\n" if request.stack_trace else "\n")
        + f"Logic agent: {str(a1)[:250]}\n\n"
        + f"Runtime agent: {str(a2)[:250]}\n\n"
        + f"Config agent: {str(a3)[:250]}\n\n"
        + "Write synthesis:"
    )

    try:
        synthesis = await ai.call(short_synthesis_system, synthesis_prompt, max_tokens=300)
    except Exception as exc:
        synthesis = f"Synthesis failed: {exc}"

    return {"synthesis": synthesis}

