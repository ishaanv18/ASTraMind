"""
cache_client.py — Astramind Cache Client
DB_ENV=development → in-memory Python dict (zero setup, zero deps)
DB_ENV=production  → Upstash Redis via redis.asyncio (free 10k cmds/day)

Used primarily for indexing job progress tracking and short-lived caching.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from config import settings

logger = logging.getLogger(__name__)

_24H = 86_400  # seconds


class CacheClient:
    """
    Unified async cache.
    dev  → plain in-memory dict (no TTL enforcement — fine for local dev)
    prod → Redis via Upstash (fully async, TLS)
    """

    def __init__(self) -> None:
        self._env = settings.DB_ENV.lower()
        self._store: Dict[str, str] = {}  # used only in dev mode
        self._redis = None  # lazily initialised in init()
        logger.info(
            "CacheClient: %s mode",
            "PRODUCTION (Redis)" if self._env == "production" else "DEVELOPMENT (in-memory)",
        )

    async def init(self) -> None:
        """Called from main.py startup. Connects Redis if in production."""
        if self._env == "production" and settings.REDIS_URL:
            try:
                import redis.asyncio as aioredis  # type: ignore
                self._redis = aioredis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=5,
                )
                await self._redis.ping()
                logger.info("CacheClient: Redis connection established.")
            except Exception as exc:
                logger.error("CacheClient: Failed to connect to Redis: %s", exc)
                # Fall back to in-memory so the app still starts
                self._redis = None
                logger.warning("CacheClient: Falling back to in-memory cache.")
        else:
            if self._env == "production":
                logger.warning(
                    "CacheClient: REDIS_URL not set in production mode — using in-memory fallback."
                )

    # ══════════════════════════════════════════════════════════════════════════
    # Core primitives
    # ══════════════════════════════════════════════════════════════════════════

    async def set(self, key: str, value: str, ttl_seconds: int = 3600) -> None:
        """Store a string value under key with optional TTL."""
        if self._redis is not None:
            await self._redis.set(key, value, ex=ttl_seconds)
        else:
            # In-memory: no TTL enforcement (acceptable for dev)
            self._store[key] = value

    async def get(self, key: str) -> Optional[str]:
        """Retrieve a string value by key, or None if missing."""
        if self._redis is not None:
            return await self._redis.get(key)
        return self._store.get(key, None)

    async def delete(self, key: str) -> None:
        """Remove a key from the cache."""
        if self._redis is not None:
            await self._redis.delete(key)
        else:
            self._store.pop(key, None)

    # ══════════════════════════════════════════════════════════════════════════
    # Progress tracking helpers (used by indexing engine)
    # ══════════════════════════════════════════════════════════════════════════

    async def set_progress(self, job_id: str, progress: Dict[str, Any]) -> None:
        """
        Persist a progress dict for a background indexing job.
        Key: progress:{job_id}
        TTL: 24 hours
        """
        key = f"progress:{job_id}"
        encoded = json.dumps(progress)
        await self.set(key, encoded, ttl_seconds=_24H)

    async def get_progress(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve progress dict for a background indexing job.
        Returns None if not found or expired.
        """
        key = f"progress:{job_id}"
        raw = await self.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("CacheClient: Corrupted progress data for job %s", job_id)
            return None

    # ══════════════════════════════════════════════════════════════════════════
    # Generic JSON helpers
    # ══════════════════════════════════════════════════════════════════════════

    async def set_json(self, key: str, value: Any, ttl_seconds: int = 3600) -> None:
        """Serialise any JSON-able value and store it."""
        await self.set(key, json.dumps(value), ttl_seconds=ttl_seconds)

    async def get_json(self, key: str) -> Optional[Any]:
        """Retrieve and deserialise a JSON value, or None."""
        raw = await self.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None


# ══════════════════════════════════════════════════════════════════════════════
# Singleton
# ══════════════════════════════════════════════════════════════════════════════

cache = CacheClient()
