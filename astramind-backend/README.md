# Astramind — AI-Powered Codebase Intelligence Platform

> **Built by a college student, zero budget, 100% free stack.**
> Semantic search · Multi-agent debugging · Security scanning · Pair programming · and 12 more AI features.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Development)](#quick-start-development)
3. [Environment Variables](#environment-variables)
4. [Switching to Production](#switching-to-production)
5. [API Reference — Curl Examples](#api-reference--curl-examples)
   - [Health](#health)
   - [Feature 1: Indexing](#feature-1-codebase-indexing)
   - [Feature 2: Search & Q&A](#feature-2-semantic-search--qa)
   - [Feature 3: Debugging](#feature-3-multi-agent-debugging)
   - [Feature 4: Diff Analysis](#feature-4-pr-diff-analysis)
   - [Feature 5: Dependency Radar](#feature-5-dependency-risk-radar)
   - [Feature 6: Architecture Guardian](#feature-6-architecture-guardian)
   - [Feature 7: Onboarding](#feature-7-onboarding-copilot)
   - [Feature 8: Security](#feature-8-security-sentinel)
   - [Feature 9: Tests](#feature-9-test-intelligence)
   - [Feature 10: Code Review](#feature-10-inline-code-review)
   - [Advanced 1: Time Machine](#advanced-1-code-time-machine)
   - [Advanced 2: Quality Trends](#advanced-2-quality-trends)
   - [Advanced 3: NL Query](#advanced-3-natural-language-query)
   - [Advanced 4: ADR Generator](#advanced-4-adr-generator)
   - [Advanced 5: Pair Programming](#advanced-5-pair-programming-chat)
   - [Advanced 6: Commit Intelligence](#advanced-6-commit-intelligence)
6. [Project Structure](#project-structure)
7. [Free Tier Limits](#free-tier-limits)

---

## Prerequisites

- **Python 3.11+** — [python.org](https://python.org)
- **Git** — [git-scm.com](https://git-scm.com)
- **Ollama** (for local AI) — install with one command:

```bash
# Linux / macOS
curl -fsSL https://ollama.com/install.sh | sh

# Windows — download installer from https://ollama.com/download
```

After installing Ollama, pull the DeepSeek Coder model:

```bash
ollama pull deepseek-coder:6.7b
```

This downloads ~4GB once. After that it runs locally, offline, forever free.

---

## Quick Start (Development)

```bash
# 1. Clone and enter the backend directory
git clone <your-repo-url>
cd astramind-backend

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — for local dev the defaults work with no changes

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Start the server
uvicorn main:app --reload --port 8000
```

The API is now running at **http://localhost:8000**

- Interactive docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health check: http://localhost:8000/health

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values as needed.

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_ENV` | `development` | `development` (Ollama) or `production` (Groq) |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `deepseek-coder:6.7b` | Local model to use |
| `GROQ_API_KEY` | *(empty)* | Free key from [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | `llama-3.1-70b-versatile` | Groq model |
| `DB_ENV` | `development` | `development` (SQLite) or `production` (Supabase) |
| `DATABASE_URL` | `sqlite+aiosqlite:///./astramind.db` | Database connection string |
| `CHROMADB_PATH` | `./chromadb_data` | ChromaDB local storage path |
| `QDRANT_URL` | *(empty)* | Qdrant Cloud cluster URL |
| `QDRANT_API_KEY` | *(empty)* | Qdrant Cloud API key |
| `REDIS_URL` | *(empty)* | Upstash Redis URL |
| `REPOS_STORAGE_PATH` | `./repos` | Where cloned repos are stored |
| `MAX_FILE_SIZE_KB` | `500` | Skip files larger than this |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `PORT` | `8000` | Server port |

---

## Switching to Production

**Step 1 — Get free accounts (no credit card for any of these):**

| Service | What it does | Sign up |
|---------|-------------|---------|
| [Groq](https://console.groq.com) | Fast AI (14,400 req/day free) | console.groq.com |
| [Supabase](https://supabase.com) | Postgres DB (500MB free) | supabase.com |
| [Qdrant Cloud](https://cloud.qdrant.io) | Vector store (1GB free) | cloud.qdrant.io |
| [Upstash](https://upstash.com) | Redis cache (10k cmd/day free) | upstash.com |

**Step 2 — Update `.env`:**

```bash
# Switch AI to Groq
AI_ENV=production
GROQ_API_KEY=your_key_from_console_groq_com

# Switch DB to Supabase + Qdrant + Upstash
DB_ENV=production
DATABASE_URL=postgresql+asyncpg://postgres:password@host.supabase.co:5432/postgres
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_KEY=your_anon_key
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your_qdrant_key
REDIS_URL=rediss://:password@host.upstash.io:6380
```

**Step 3 — Restart:**

```bash
uvicorn main:app --port 8000
```

No code changes required. Only `.env` values control the environment.

---

## API Reference — Curl Examples

All endpoints are prefixed with `/api/v1`. Streaming endpoints return `text/event-stream` — each chunk arrives as `data: {"content": "..."}` and the stream ends with `data: [DONE]`.

### Health

```bash
curl http://localhost:8000/health
```

```json
{"status":"ok","ai_env":"development","db_env":"development","ai_available":true,"version":"1.0.0"}
```

---

### Feature 1: Codebase Indexing

**Index a local repository:**
```bash
curl -X POST http://localhost:8000/api/v1/index/repository \
  -H "Content-Type: application/json" \
  -d '{
    "repo_path": "/absolute/path/to/your/project",
    "repo_name": "My Project"
  }'
```

**Index a GitHub repository:**
```bash
curl -X POST http://localhost:8000/api/v1/index/repository \
  -H "Content-Type: application/json" \
  -d '{
    "github_url": "https://github.com/username/repo",
    "repo_name": "My GitHub Repo"
  }'
```

**Poll indexing progress:**
```bash
curl http://localhost:8000/api/v1/index/status/{repo_id}
```

**List all indexed repositories:**
```bash
curl http://localhost:8000/api/v1/index/repositories
```

**Get a single repository:**
```bash
curl http://localhost:8000/api/v1/index/repository/{repo_id}
```

**Delete a repository:**
```bash
curl -X DELETE http://localhost:8000/api/v1/index/repository/{repo_id}
```

---

### Feature 2: Semantic Search & Q&A

**Search for code:**
```bash
curl "http://localhost:8000/api/v1/search?query=authentication+middleware&repo_id={repo_id}&top_k=10"

# Filter by language
curl "http://localhost:8000/api/v1/search?query=database+connection&repo_id={repo_id}&language=python"
```

**Ask a question about the codebase (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How does authentication work in this codebase?",
    "repo_id": "{repo_id}"
  }'
```

---

### Feature 3: Multi-Agent Debugging

**Analyze an error with 3 specialist agents:**
```bash
curl -X POST http://localhost:8000/api/v1/debug/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "error_message": "AttributeError: NoneType object has no attribute split",
    "stack_trace": "File app.py line 42 in process_input\n  result = user_input.split()",
    "repo_id": "{repo_id}",
    "affected_file": "app.py"
  }'
```

**Stream the synthesis agent:**
```bash
curl -N -X POST http://localhost:8000/api/v1/debug/stream-synthesis \
  -H "Content-Type: application/json" \
  -d '{
    "error_message": "AttributeError: NoneType object has no attribute split",
    "stack_trace": "File app.py line 42 in process_input",
    "repo_id": "{repo_id}"
  }'
```

---

### Feature 4: PR Diff Analysis

**Analyze a diff from two branches (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/diff/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "base_branch": "main",
    "compare_branch": "feature/auth"
  }'
```

**Analyze a raw diff string (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/diff/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "diff_text": "diff --git a/app.py b/app.py\n..."
  }'
```

**Generate GitHub PR description (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/diff/pr-description \
  -H "Content-Type: application/json" \
  -d '{
    "diff_text": "diff --git a/app.py b/app.py\n..."
  }'
```

---

### Feature 5: Dependency Risk Radar

**Analyze dependencies from a repo (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/deps/analyze \
  -H "Content-Type: application/json" \
  -d '{"repo_id": "{repo_id}"}'
```

**Analyze a requirements.txt content (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/deps/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "file_content": "fastapi==0.100.0\nrequests==2.28.0\nnumpy==1.24.0",
    "file_type": "requirements"
  }'
```

**Get raw dependency metadata (no AI):**
```bash
curl -X POST http://localhost:8000/api/v1/deps/metadata \
  -H "Content-Type: application/json" \
  -d '{
    "file_content": "django==3.0.0\nrequests==2.18.0",
    "file_type": "requirements"
  }'
```

---

### Feature 6: Architecture Guardian

**Check new code against codebase patterns (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/architecture/check \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "new_file_path": "routers/payments.py",
    "new_code": "def process_payment(amount):\n    db.execute(f\"INSERT INTO payments VALUES ({amount})\")"
  }'
```

**Get stored architectural patterns:**
```bash
curl http://localhost:8000/api/v1/architecture/patterns/{repo_id}
```

**Force re-detection of patterns:**
```bash
curl -X POST http://localhost:8000/api/v1/architecture/detect-patterns/{repo_id}
```

---

### Feature 7: Onboarding Copilot

**Get a role-specific onboarding tour (streaming):**
```bash
# Roles: frontend | backend | fullstack | devops | new
curl -N -X POST http://localhost:8000/api/v1/onboard/tour \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "role": "backend"
  }'
```

**Explain a specific code section (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/onboard/explain \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "file_path": "auth/jwt.py",
    "line_start": 45,
    "line_end": 78
  }'
```

---

### Feature 8: Security Sentinel

**Scan an entire repository (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/security/scan \
  -H "Content-Type: application/json" \
  -d '{"repo_id": "{repo_id}"}'
```

**Scan a code snippet (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/security/scan \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def get_user(id):\n    db.execute(f\"SELECT * FROM users WHERE id={id}\")",
    "language": "python"
  }'
```

**Get security scan history:**
```bash
curl http://localhost:8000/api/v1/security/history/{repo_id}
```

---

### Feature 9: Test Intelligence

**Generate tests for a file (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/tests/generate \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "target_file_path": "utils/validation.py"
  }'
```

**Generate tests for a code snippet (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/tests/generate \
  -H "Content-Type: application/json" \
  -d '{
    "code_snippet": "def divide(a, b):\n    return a / b",
    "language": "python"
  }'
```

**Detect stale tests:**
```bash
curl -X POST http://localhost:8000/api/v1/tests/stale \
  -H "Content-Type: application/json" \
  -d '{"repo_id": "{repo_id}"}'
```

---

### Feature 10: Inline Code Review

**Get a streaming code review:**
```bash
curl -N -X POST http://localhost:8000/api/v1/review/inline \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "file_path": "api/users.py",
    "code": "def create_user(data):\n    user = User(**data)\n    db.add(user)\n    db.commit()",
    "cursor_line": 3
  }'
```

**Start or continue a review chat (streaming):**
```bash
# First message (no conversation_id) — creates new conversation
curl -N -X POST http://localhost:8000/api/v1/review/chat \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "message": "Why is the authentication middleware not checking tokens?"
  }'

# Follow-up message
curl -N -X POST http://localhost:8000/api/v1/review/chat \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "conversation_id": "{conv_id}",
    "message": "Can you show me how to fix that?"
  }'
```

**List all review conversations:**
```bash
curl http://localhost:8000/api/v1/review/conversations/{repo_id}
```

**Delete a conversation:**
```bash
curl -X DELETE http://localhost:8000/api/v1/review/conversation/{conv_id}
```

---

### Advanced 1: Code Time Machine

**Answer a question about how the code looked at a past date (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/timemachine/query \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "question": "How did the authentication system work?",
    "as_of_date": "2024-01-15"
  }'
```

The response headers contain `X-Historical-Answer` and `X-Current-Answer` (base64-encoded), and the SSE stream contains the evolution diff summary.

---

### Advanced 2: Quality Trends

**Compute and stream quality trends (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/trends/quality \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "days_back": 30
  }'
```

**Get stored history (no AI):**
```bash
curl "http://localhost:8000/api/v1/trends/history/{repo_id}?days_back=90"
```

---

### Advanced 3: Natural Language Query

**Query with natural language:**
```bash
# Find all async functions without error handling
curl -X POST http://localhost:8000/api/v1/nl/query \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "query": "find all async functions without error handling"
  }'

# Show everywhere we touch the database
curl -X POST http://localhost:8000/api/v1/nl/query \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "query": "show everywhere we touch the database"
  }'

# Find functions longer than 50 lines
curl -X POST http://localhost:8000/api/v1/nl/query \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "query": "find functions longer than 50 lines"
  }'

# Find files importing from utils
curl -X POST http://localhost:8000/api/v1/nl/query \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "query": "which files import from utils?"
  }'
```

---

### Advanced 4: ADR Generator

**Auto-generate Architecture Decision Records from git history:**
```bash
curl -X POST http://localhost:8000/api/v1/adr/generate \
  -H "Content-Type: application/json" \
  -d '{"repo_id": "{repo_id}"}'
```

Response includes:
- `adrs`: list of ADR documents with confidence scores
- `folder_structure`: `{filename: content}` dict ready to write to `/docs/adr/`

---

### Advanced 5: Pair Programming Chat

**Start a pair programming session (streaming):**
```bash
curl -N -X POST http://localhost:8000/api/v1/pair/chat \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "message": "I need to add rate limiting to the API. Where should I start?"
  }'
```

The `X-Conversation-Id` response header contains the conversation ID for follow-up messages.

**Continue a session:**
```bash
curl -N -X POST http://localhost:8000/api/v1/pair/chat \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "conversation_id": "{conv_id}",
    "message": "Show me the complete implementation for the middleware."
  }'
```

**List all sessions:**
```bash
curl http://localhost:8000/api/v1/pair/conversations/{repo_id}
```

**Delete a session:**
```bash
curl -X DELETE http://localhost:8000/api/v1/pair/conversations/{conv_id}
```

---

### Advanced 6: Commit Intelligence

**Generate a Conventional Commit message from staged changes:**
```bash
# Auto-reads staged changes (git diff HEAD)
curl -X POST http://localhost:8000/api/v1/commits/message \
  -H "Content-Type: application/json" \
  -d '{"repo_id": "{repo_id}"}'
```

**Generate from a diff string:**
```bash
curl -X POST http://localhost:8000/api/v1/commits/message \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "diff_text": "diff --git a/auth/jwt.py b/auth/jwt.py\n+def refresh_token(token):\n+    ..."
  }'
```

**Analyze commit message quality:**
```bash
curl -X POST http://localhost:8000/api/v1/commits/history-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "{repo_id}",
    "limit": 50
  }'
```

---

## Project Structure

```
astramind-backend/
├── main.py                  # FastAPI app, lifespan, CORS, router registration
├── config.py                # Pydantic BaseSettings — all env vars
├── database_client.py       # SQLite (dev) / Supabase Postgres (prod) + ORM models
├── vector_client.py         # ChromaDB (dev) / Qdrant Cloud (prod)
├── cache_client.py          # In-memory dict (dev) / Upstash Redis (prod)
├── ai_client.py             # Ollama (dev) / Groq (prod) + SSE helper + singleton
├── models/
│   └── schemas.py           # All Pydantic request/response schemas
├── parser/
│   ├── tree_sitter_parser.py   # Multi-language AST parser + quality metrics
│   ├── git_analyzer.py         # Git clone, diff, blame, history, checkout
│   └── embedder.py             # sentence-transformers all-MiniLM-L6-v2
├── routers/
│   ├── index.py             # Feature 1: Indexing engine
│   ├── search.py            # Feature 2: Semantic search + RAG Q&A
│   ├── debug.py             # Feature 3: Multi-agent debugging
│   ├── diff.py              # Feature 4: PR diff analysis
│   ├── deps.py              # Feature 5: Dependency risk radar
│   ├── architecture.py      # Feature 6: Architecture guardian
│   ├── onboard.py           # Feature 7: Onboarding copilot
│   ├── security.py          # Feature 8: Security sentinel
│   ├── tests.py             # Feature 9: Test intelligence
│   ├── review.py            # Feature 10: Inline code review
│   ├── timemachine.py       # Advanced 1: Code time machine
│   ├── trends.py            # Advanced 2: Quality trend tracker
│   ├── nl_query.py          # Advanced 3: NL code query
│   ├── adr.py               # Advanced 4: ADR generator
│   ├── pair.py              # Advanced 5: Pair programming
│   └── commits.py           # Advanced 6: Commit intelligence
├── requirements.txt
├── .env.example
└── README.md
```

---

## Free Tier Limits

| Service | Free Tier | What it affects |
|---------|-----------|-----------------|
| Ollama / DeepSeek Coder | Unlimited (local) | AI in dev mode |
| Groq API | 14,400 req/day, 500k tokens/min | AI in prod mode |
| Supabase Postgres | 500MB storage | Repository metadata |
| Qdrant Cloud | 1GB vector storage | ~2M code chunks |
| Upstash Redis | 10,000 commands/day | Job progress, caching |
| Supabase Storage | 1GB | Cloned repos, ADR files |

**Tips to stay within limits:**
- Index only what you need — delete repos when done (`DELETE /api/v1/index/repository/{id}`)
- NL queries and stale test detection use AI sparingly (one call per request)
- Quality trends uses zero AI for metric computation — only one call for the narrative
- ADR generation batches all groups into one `asyncio.gather()` call

---

## Troubleshooting

**Ollama not responding:**
```bash
# Start Ollama service
ollama serve

# Verify model is downloaded
ollama list
```

**Indexing stuck at 0%:**
- Check `GET /api/v1/index/status/{repo_id}` — look at the `error` field
- Large repos (>10k files) may take several minutes locally
- For very large repos, increase `MAX_FILE_SIZE_KB` in `.env`

**ChromaDB collection errors:**
```bash
# Reset local vector store (dev only)
rm -rf ./chromadb_data
```

**Tree-sitter grammar not found:**
```bash
# Reinstall grammars
pip install tree-sitter-python tree-sitter-javascript tree-sitter-java tree-sitter-go tree-sitter-rust
```

---

*Astramind — because your codebase deserves an AI that actually reads it.*
