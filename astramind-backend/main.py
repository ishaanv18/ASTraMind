"""
main.py — Astramind FastAPI Application Entry Point
Registers all 16 routers, runs startup hooks, exposes /health.
"""

from __future__ import annotations

import logging
import os
import shutil
from contextlib import asynccontextmanager

# ── Ensure gitpython can find git.exe regardless of PATH ─────────────────────
if not os.environ.get("GIT_PYTHON_GIT_EXECUTABLE"):
    _git = shutil.which("git") or (
        next(
            (p for p in [
                r"C:\Program Files\Git\cmd\git.exe",
                r"C:\Program Files\Git\bin\git.exe",
                r"/usr/bin/git", r"/usr/local/bin/git",
            ] if os.path.isfile(p)), None
        )
    )
    if _git:
        os.environ["GIT_PYTHON_GIT_EXECUTABLE"] = _git

# ── Silence noisy 3rd-party telemetry errors (ChromaDB posthog bug) ──────────
logging.getLogger("chromadb.telemetry.product.posthog").setLevel(logging.CRITICAL)
logging.getLogger("chromadb.telemetry").setLevel(logging.CRITICAL)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import settings
from database_client import db
from vector_client import vector
from cache_client import cache
from ai_client import ai

# ── Rate Limiter — shared across all routers ──────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

# ── Routers ───────────────────────────────────────────────────────────────────
from routers import (
    index,
    search,
    debug,
    diff,
    deps,
    architecture,
    onboard,
    security,
    tests,
    review,
    timemachine,
    trends,
    nl_query,
    adr,
    pair,
    commits,
    contact,
    auth,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("astramind.main")


# ══════════════════════════════════════════════════════════════════════════════
# Lifespan — startup / shutdown
# ══════════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs once on startup before serving requests, and once on shutdown.
    Order matters: db → vector → cache (cache may depend on the others being up).
    """
    logger.info("═" * 60)
    logger.info("  Astramind API starting up (AI_ENV=%s, DB_ENV=%s)", settings.AI_ENV, settings.DB_ENV)
    logger.info("═" * 60)

    # 1. Database tables
    try:
        await db.create_all_tables()
        logger.info("✓ Database ready")
    except Exception as exc:
        logger.error("✗ Database startup failed: %s", exc)

    # 2. Vector store
    try:
        await vector.init()
        logger.info("✓ Vector store ready")
    except Exception as exc:
        logger.error("✗ Vector store startup failed: %s", exc)

    # 3. Cache
    try:
        await cache.init()
        logger.info("✓ Cache ready")
    except Exception as exc:
        logger.error("✗ Cache startup failed: %s", exc)

    # 4. AI availability (non-fatal)
    try:
        available = await ai.is_available()
        if available:
            logger.info("✓ AI backend available (%s)", settings.AI_ENV)
        else:
            logger.warning("⚠ AI backend NOT available — check Ollama/Groq config")
    except Exception as exc:
        logger.warning("⚠ Could not check AI availability: %s", exc)

    logger.info("═" * 60)
    logger.info("  Astramind API is ready  →  http://localhost:%d", settings.PORT)
    logger.info("═" * 60)

    yield  # ─── application runs here ───

    logger.info("Astramind API shutting down.")


# ══════════════════════════════════════════════════════════════════════════════
# Application instance
# ══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Astramind API",
    description=(
        "AI-Powered Codebase Intelligence Platform. "
        "Semantic search, multi-agent debugging, security scanning, and more."
    ),
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate Limiting ─────────────────────────────────────────────────────────────
# Default: 60 req/min per IP for all endpoints.
# AI-heavy endpoints use stricter limits applied at the router level.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ══════════════════════════════════════════════════════════════════════════════
# Register routers
# ══════════════════════════════════════════════════════════════════════════════

PREFIX = "/api/v1"

app.include_router(index.router,        prefix=PREFIX, tags=["Indexing"])
app.include_router(search.router,       prefix=PREFIX, tags=["Search & Q&A"])
app.include_router(debug.router,        prefix=PREFIX, tags=["Debugging"])
app.include_router(diff.router,         prefix=PREFIX, tags=["Diff Analysis"])
app.include_router(deps.router,         prefix=PREFIX, tags=["Dependency Radar"])
app.include_router(architecture.router, prefix=PREFIX, tags=["Architecture Guardian"])
app.include_router(onboard.router,      prefix=PREFIX, tags=["Onboarding Copilot"])
app.include_router(security.router,     prefix=PREFIX, tags=["Security Sentinel"])
app.include_router(tests.router,        prefix=PREFIX, tags=["Test Intelligence"])
app.include_router(review.router,       prefix=PREFIX, tags=["Code Review"])
app.include_router(timemachine.router,  prefix=PREFIX, tags=["Code Time Machine"])
app.include_router(trends.router,       prefix=PREFIX, tags=["Quality Trends"])
app.include_router(nl_query.router,     prefix=PREFIX, tags=["Natural Language Query"])
app.include_router(adr.router,          prefix=PREFIX, tags=["ADR Generator"])
app.include_router(pair.router,         prefix=PREFIX, tags=["Pair Programming"])
app.include_router(commits.router,      prefix=PREFIX, tags=["Commit Intelligence"])
app.include_router(contact.router,      prefix=PREFIX, tags=["Support & Contact"])
app.include_router(auth.router,          prefix=PREFIX, tags=["Authentication"])

# ══════════════════════════════════════════════════════════════════════════════
# Health check
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health", tags=["Health"], summary="Service health and configuration status")
async def health_check():
    """
    Returns current runtime configuration and AI backend availability.
    Useful for monitoring and deployment verification.
    """
    try:
        ai_available = await ai.is_available()
    except Exception:
        ai_available = False

    return JSONResponse(
        content={
            "status": "ok",
            "ai_env": settings.AI_ENV,
            "db_env": settings.DB_ENV,
            "ai_available": ai_available,
            "version": settings.APP_VERSION,
        }
    )


# ══════════════════════════════════════════════════════════════════════════════
# Dev entry point
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
        log_level="info",
    )
