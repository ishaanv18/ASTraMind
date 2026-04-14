# ── Astramind Backend — Production Dockerfile ──────────────────────────────
# Build:  docker build -t astramind-backend .
# Run:    docker run -p 8000:8000 --env-file .env -v astramind_data:/data astramind-backend
#
# All persistent data (SQLite DB, ChromaDB, cloned repos) is written to the
# /data volume so it SURVIVES container restarts and redeploys.

FROM python:3.11-slim

# ── System dependencies ──────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify git is available (fail fast if missing)
RUN git --version

WORKDIR /app

# ── Python dependencies (layer-cached separately from app code) ──────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Application code ─────────────────────────────────────────────────────────
COPY . .

# ── Persistent data volume ───────────────────────────────────────────────────
# All data is stored under /data which must be mounted as a Docker volume.
# This prevents data loss on container redeploy.
#   /data/astramind.db       → SQLite database (repos, sessions, metadata)
#   /data/chromadb_data/     → ChromaDB vector embeddings index
#   /data/repos/             → Temp clone space (auto-cleaned after indexing)
RUN mkdir -p /data/repos /data/chromadb_data
VOLUME ["/data"]

# ── API port ─────────────────────────────────────────────────────────────────
EXPOSE 8000

# ── Health check ─────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# ── Production server (no --reload in prod) ───────────────────────────────────
CMD ["python", "-m", "uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2"]
