"""
ai_client.py — Astramind AI Client
Switches between Ollama (dev) and Groq (prod) based on AI_ENV.
Never import Groq SDK or call Ollama directly from routers — always use this module.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import AsyncGenerator

import httpx

from config import settings

logger = logging.getLogger(__name__)


class AIClient:
    """
    Unified AI client.
    AI_ENV=development  → Ollama + DeepSeek Coder (local, free, offline-capable)
    AI_ENV=production   → Groq API (fast free tier, 14 400 req/day)
    """

    def __init__(self) -> None:
        self._env = settings.AI_ENV.lower()
        self._groq_client = None
        if self._env == "production":
            try:
                from groq import AsyncGroq  # type: ignore
                self._groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
                logger.info("AIClient initialised in PRODUCTION mode (Groq)")
            except ImportError:
                logger.error("groq package not installed. Run: pip install groq")
                raise
        else:
            logger.info("AIClient initialised in DEVELOPMENT mode (Ollama)")

    # ── Core: non-streaming call ───────────────────────────────────────────────

    async def call(
        self,
        system: str,
        user: str,
        max_tokens: int = 4096,
    ) -> str:
        """Single-shot AI call. Returns full response string."""
        if self._env == "production":
            return await self._groq_call(system, user, max_tokens)
        return await self._ollama_call(system, user, max_tokens)

    # ── Core: streaming call ───────────────────────────────────────────────────

    async def stream(
        self,
        system: str,
        user: str,
    ) -> AsyncGenerator[str, None]:
        """Streaming AI call. Yields text chunks as they arrive."""
        if self._env == "production":
            async for chunk in self._groq_stream(system, user):
                yield chunk
        else:
            async for chunk in self._ollama_stream(system, user):
                yield chunk

    # ── Core: call with exponential-backoff retry ──────────────────────────────

    async def call_with_retry(
        self,
        system: str,
        user: str,
        max_tokens: int = 4096,
        retries: int = 3,
    ) -> str:
        """
        Call with retry on transient failures.
        Waits 2^attempt seconds between attempts (1 s, 2 s, 4 s).
        Raises on final failure.
        """
        last_exc: Exception = RuntimeError("No attempts made")
        for attempt in range(retries):
            try:
                return await self.call(system, user, max_tokens)
            except Exception as exc:
                last_exc = exc
                wait = 2 ** attempt
                logger.warning(
                    "AIClient retry %d/%d after %ds. Error: %s",
                    attempt + 1,
                    retries,
                    wait,
                    exc,
                )
                await asyncio.sleep(wait)
        raise last_exc

    # ── Availability check ─────────────────────────────────────────────────────

    async def is_available(self) -> bool:
        """
        development: ping Ollama /api/tags
        production: check GROQ_API_KEY is set
        """
        if self._env == "production":
            return bool(settings.GROQ_API_KEY)
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False

    # ══════════════════════════════════════════════════════════════════════════
    # Private: Ollama implementation
    # ══════════════════════════════════════════════════════════════════════════

    async def _ollama_call(self, system: str, user: str, max_tokens: int) -> str:
        url = f"{settings.OLLAMA_BASE_URL}/api/chat"
        # Hard limits for CPU inference (deepseek-coder:1.3b @ ~6 tok/s)
        cap = min(max_tokens, 1000)  # 1000 tokens ≈ 2.5 min — enough for complete reports
        if len(system) > 900:
            system = system[:900]
        if len(user) > 4000:
            user = user[:4000] + "\n\n[...truncated...]"

        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
            "options": {"num_predict": cap, "num_ctx": 2048},
        }
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["message"]["content"]

    async def _ollama_stream(
        self, system: str, user: str
    ) -> AsyncGenerator[str, None]:
        url = f"{settings.OLLAMA_BASE_URL}/api/chat"
        # Keep context very small for fast CPU inference
        max_chars = 3000
        if len(user) > max_chars:
            user = user[:max_chars] + "\n\n[...truncated...]"
        if len(system) > 800:
            system = system[:800]
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": True,
            "options": {"num_ctx": 2048, "num_predict": 512},
        }
        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream("POST", url, json=payload) as resp:
                resp.raise_for_status()
                async for raw_line in resp.aiter_lines():
                    if not raw_line.strip():
                        continue
                    try:
                        data = json.loads(raw_line)
                    except json.JSONDecodeError:
                        continue
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield content
                    if data.get("done", False):
                        break


    # ══════════════════════════════════════════════════════════════════════════
    # Private: Groq implementation
    # ══════════════════════════════════════════════════════════════════════════

    def _pick_groq_model(self, user: str, system: str) -> str:
        """Use fallback model when combined context exceeds ~8k tokens (rough 4-char/token estimate)."""
        total_chars = len(system) + len(user)
        if total_chars > 32_000:  # ≈ 8 000 tokens × 4 chars
            return settings.GROQ_FALLBACK_MODEL
        return settings.GROQ_MODEL

    async def _groq_call(self, system: str, user: str, max_tokens: int) -> str:
        model = self._pick_groq_model(system, user)
        response = await self._groq_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    async def _groq_stream(
        self, system: str, user: str
    ) -> AsyncGenerator[str, None]:
        model = self._pick_groq_model(system, user)
        stream = await self._groq_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta
            content = getattr(delta, "content", None) or ""
            if content:
                yield content


# ══════════════════════════════════════════════════════════════════════════════
# SSE Helper — import in all streaming routers
# ══════════════════════════════════════════════════════════════════════════════

async def sse_generator(
    system: str, user: str
) -> AsyncGenerator[str, None]:
    """
    Wraps ai.stream() into Server-Sent Events format.
    Each yielded string is a complete SSE line ready for StreamingResponse.
    Usage:
        return StreamingResponse(sse_generator(system, user), media_type="text/event-stream")
    """
    try:
        async for chunk in ai.stream(system, user):
            payload = json.dumps({"content": chunk})
            yield f"data: {payload}\n\n"
    except Exception as exc:
        error_payload = json.dumps({"error": str(exc)})
        yield f"data: {error_payload}\n\n"
    finally:
        yield "data: [DONE]\n\n"


# ══════════════════════════════════════════════════════════════════════════════
# Singleton — the ONE instance used by every router
# ══════════════════════════════════════════════════════════════════════════════

ai = AIClient()
