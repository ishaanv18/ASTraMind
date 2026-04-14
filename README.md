<div align="center">

# 🌌 ASTraMind
### *AI-Powered Code Intelligence Platform*

**The missing AI co-pilot for your entire engineering team.**

[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![Groq](https://img.shields.io/badge/Groq-LLaMA%203.3-FF6600?style=for-the-badge)](https://groq.com)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector%20Store-purple?style=for-the-badge)](https://www.trychroma.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

> **ASTraMind Beta 1.0** — Where Abstract Syntax Trees meet Artificial Intelligence.

</div>

---

## 📖 Table of Contents

1. [What is ASTraMind?](#-what-is-astramind)
2. [Observation](#-observation)
3. [Problem Statement](#-problem-statement)
4. [Our Solution](#-our-solution)
5. [Features](#-features)
6. [User Workflow](#-user-workflow)
7. [System Architecture](#-system-architecture)
8. [Tech Stack](#-tech-stack)
9. [Installation & Setup](#-installation--setup)
10. [Environment Variables](#-environment-variables)
11. [API Reference](#-api-reference)
12. [Future Scope](#-future-scope)
13. [Contributing](#-contributing)

---

## 🌟 What is ASTraMind?

**ASTraMind** (Abstract Syntax Tree & AI Mind) is a full-stack, AI-powered code intelligence platform designed to provide software engineering teams with deep, instant, and context-aware understanding of any GitHub codebase.

It is a **developer-first co-pilot** that goes beyond syntax highlighting. By combining parse-tree analysis, semantic vector embeddings, and large language models (LLMs), ASTraMind transforms a raw repository into an **interactive, queryable knowledge base** — enabling engineers of all roles—from new hires to senior architects—to navigate and understand large, complex codebases in minutes, not weeks.

Think of it as your **permanent senior engineer on-call**, available 24/7, who has read every single line of your repository and can answer any question about it instantly.

---

## 🔭 Observation

Modern software teams face a constant friction point: **code complexity grows exponentially, while human cognitive capacity stays fixed.** The following trends have emerged across the industry:

- **Repository sizes are ballooning.** The average enterprise codebase has grown to hundreds of thousands of lines of code across multiple services.
- **Context-switching is catastrophically expensive.** An engineer joining a new team spends an average of **3–6 months** before becoming meaningfully productive.
- **Code reviews are bottlenecks.** PR review queues grow faster than they can be cleared, leading to rushed approvals and escaped bugs.
- **Institutional knowledge is fragile.** When a senior engineer leaves, years of architectural reasoning leave with them.
- **Documentation is perpetually stale.** Auto-generated docs don't explain *why* the code was written this way, only *what* it does on the surface.
- **Security debt is invisible.** OWASP vulnerabilities and anti-patterns accumulate silently across large teams without dedicated security reviews.

These observations collectively point to a single conclusion: **the tools to understand code haven't kept pace with the complexity of the code itself.**

---

## 🚨 Problem Statement

> *"How do I understand what this codebase actually does, who wrote what, why they made these decisions, and where the risks are — without spending weeks reading files?"*

This question is faced by:
- **New team members** who need to get up to speed quickly.
- **Engineering managers** who need a high-level architectural overview.
- **Security engineers** doing ad-hoc audits without full codebase context.
- **Senior engineers** doing code reviews who lack time to deeply trace every change.
- **DevOps/SRE teams** debugging production incidents at 3am with unfamiliar code.

Existing tools fall short:
| Tool | Limitation |
|---|---|
| IDEs (VS Code, JetBrains) | File-level, require local setup, no natural language |
| GitHub Copilot | Generates code but doesn't *explain* existing codebases |
| Code search (grep, sourcegraph) | Keyword-only, no semantic understanding |
| Static analyzers (SonarQube) | Rules-based, no contextual reasoning |
| LLMs (ChatGPT, Claude) | No live repo access, context window limits, no codebase memory |

**No single solution combines real-time repo indexing, semantic search, and AI reasoning across all these use cases simultaneously.**

---

## 💡 Our Solution

**ASTraMind** is a unified intelligence layer that sits on top of any GitHub repository and provides:

1. **Semantic Indexing Engine** — Parses the entire repository, chunks code intelligently by logical functions and classes, generates vector embeddings, and stores them in a queryable vector database (ChromaDB). This index persists across sessions.

2. **Natural Language Interface** — Lets you ask any question in plain English ("How does authentication work?", "Where is the payment processing code?") and get grounded, cited answers backed by actual code chunks.

3. **AI Agent Suite** — 15 specialized AI agents, each a domain expert: code review, security audit, debug analysis, architecture mapping, dependency analysis, and more.

4. **Persistent Knowledge Graph** — The indexed repository becomes a living knowledge base that the entire team can query simultaneously, not just the individual developer.

5. **Role-Aware Onboarding** — Generates a customized codebase tour based on your engineering role (frontend, backend, DevOps, etc.) so you learn what's most relevant, first.

The result: **from repository URL to actionable intelligence in under 60 seconds.**

---

## ✨ Features

### 1. 🔍 Semantic Search
Understand, don't just `grep`. ASTraMind's search engine uses vector embeddings to find semantically similar code, even if the exact words don't match. Search by concept ("error handling", "user authentication") and get ranked, contextualized results with matching code snippets.

### 2. 🤖 AI Synthesis (Ask Anything)
Ask any natural-language question about your entire codebase and get a comprehensive, cited AI answer. The response is grounded in real code retrieved from the vector index, eliminating hallucinations common to standard LLM interactions.

### 3. 🗺️ Codebase Tour (Onboarding)
New to a project? Generate a personalized tour. Select your role (Frontend Dev, Backend Dev, DevOps, Full-Stack, New Team Member) and ASTraMind generates a structured, curated walkthrough of the most relevant parts of the codebase for that role.

### 4. 🔎 Code Block Explainer
Paste any file path and line range, and get a plain-English explanation of exactly what that code does, why it exists, and what edge cases it handles. Perfect for understanding legacy code or unfamiliar libraries.

### 5. 🛡️ Security Sentinel
Automatically scans your codebase for OWASP Top 10 vulnerabilities, CWE patterns, and common security anti-patterns. Returns severity-ranked vulnerabilities with file paths, line numbers, and remediation advice — all powered by AI.

### 6. 📐 Architecture Guardian
Generate a high-level architectural overview of the entire project. Understand the top-level modules, their responsibilities, how they interact, and what the data flow looks like — all without reading a single line of code.

### 7. 🐛 Debug Agents
Describe a bug or paste an error stack trace. ASTraMind searches the codebase for the most relevant code, identifies the likely root cause, and suggests specific fixes with code examples.

### 8. 📦 Dependency Radar
Paste your `requirements.txt`, `package.json`, `pyproject.toml`, or `pom.xml` and get a comprehensive AI audit of all dependencies: outdated versions, known CVEs, licensing risks, and upgrade recommendations.

### 9. 🔄 Diff Analysis
Analyze the semantic impact of code changes. Paste a git diff and get an AI explanation of what the change does, its potential side effects, and whether it introduces any risks.

### 10. 📜 Commit Intelligence
Scan recent git commits and generate human-readable summaries and release notes. Understand what changed, when, and why — without reading raw commit messages.

### 11. 📊 Code Trends
Analyze code quality metrics over a configurable time period. Track complexity growth, TODO accumulation, documentation coverage, and other health indicators across your repository.

### 12. 🧪 Test Generator
Automatically generate comprehensive unit and integration tests for any file or function. Supports Python (pytest), JavaScript/TypeScript (Jest), Go, and Java (JUnit).

### 13. 🧠 Pair Programmer
An interactive AI programming assistant that uses your codebase as context. Ask it to write new features, refactor existing code, explain patterns, or suggest improvements — all with your repository's conventions in mind.

### 14. 🗄️ ADR Generator (Architecture Decision Records)
Automatically generate formal Architecture Decision Records (ADRs) from your codebase, capturing key design choices, the context behind them, and alternatives considered.

### 15. ⏱️ Time Machine
Query the repository at any historical point in time. Understand what the codebase looked like 6 months ago, what changed since then, and why decisions were made at specific moments.

### 16. 🔗 Natural Language to SQL/Query
Translate natural language questions about your data models or API behavior directly into executable queries, saving time and eliminating guesswork.

---

## 🔄 User Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                      USER JOURNEY                           │
└─────────────────────────────────────────────────────────────┘

   STEP 1: CONNECT
   ────────────────
   Visit ASTraMind → Authenticate with GitHub PAT
   → Platform verifies credentials → User session begins
   (First-time users see the Platform Onboarding Tour)

         │
         ▼

   STEP 2: SELECT REPOSITORY
   ──────────────────────────
   Open RepoManager → Enter GitHub repository URL
   → Select branch → Click "Index Repository"

         │
         ▼

   STEP 3: INDEXING (One-time per repo)
   ──────────────────────────────────────
   Backend clones repository → Parses files by type
   → Chunks code into logical units (functions, classes)
   → Generates vector embeddings (sentence-transformers)
   → Stores embeddings in ChromaDB → Index complete ✅
   (Subsequent visits skip this step — index is cached)

         │
         ▼

   STEP 4: EXPLORE
   ─────────────────
   Navigate the 15-feature Feature Suite in the Sidebar:
   • Ask questions via Semantic Search / AI Synthesis
   • Run Security Scans, Debug Sessions, Code Reviews
   • Generate Tests, ADRs, Architecture Maps
   • Onboard new team members with Role Tours

         │
         ▼

   STEP 5: SHARE
   ──────────────
   The knowledge base is scoped to your GitHub account
   but accessible to any team member with credentials.
   Invite teammates to connect and explore the same index.
```

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ASTRAMIND ARCHITECTURE                        │
└──────────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────┐
 │                  FRONTEND (React + Vite)            │
 │  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
 │  │  Sidebar │  │  TopBar  │  │    Page Components │ │
 │  │  NavMenu │  │  RepoMgr │  │  (15 AI Features)  │ │
 │  └──────────┘  └──────────┘  └───────────────────┘ │
 │        │             │                │             │
 │        └─────────────┴────────────────┘             │
 │                       │                             │
 │              Zustand State Store                    │
 │           (auth, currentRepo, theme)                │
 └────────────────────┬────────────────────────────────┘
                      │ HTTP (REST API)
                      │ axios / fetch
 ┌────────────────────▼────────────────────────────────┐
 │               BACKEND (FastAPI + Python)            │
 │                                                     │
 │  ┌─────────────────────────────────────────────┐   │
 │  │              API ROUTERS (18 modules)        │   │
 │  │  /index  /search  /onboard  /security        │   │
 │  │  /review /debug   /deps     /tests           │   │
 │  │  /trends /commits /diff     /architecture    │   │
 │  │  /adr    /pair    /nl_query /timemachine      │   │
 │  │  /contact                                    │   │
 │  └─────────────────┬───────────────────────────┘   │
 │                    │                                │
 │  ┌─────────────────▼───────────────────────────┐   │
 │  │              CORE SERVICES                   │   │
 │  │                                              │   │
 │  │  ┌──────────────┐    ┌─────────────────┐    │   │
 │  │  │  ai_client   │    │  indexer.py     │    │   │
 │  │  │  (Groq Cloud │    │  (AST Parser +  │    │   │
 │  │  │   LLaMA 3.3) │    │   Chunker)      │    │   │
 │  │  └──────┬───────┘    └────────┬────────┘    │   │
 │  │         │                     │             │   │
 │  │         │            ┌────────▼────────┐    │   │
 │  │         │            │   ChromaDB      │    │   │
 │  │         │            │  (Vector Store) │    │   │
 │  │         │            │  sentence-      │    │   │
 │  │         │            │  transformers   │    │   │
 │  │         │            └─────────────────┘    │   │
 │  └─────────▼────────────────────────────────   │   │
 │            │                                   │   │
 │  ┌─────────▼────────────────────────────────┐  │   │
 │  │        EXTERNAL SERVICES                 │  │   │
 │  │  ┌──────────────┐  ┌──────────────────┐  │  │   │
 │  │  │  Groq Cloud  │  │  GitHub REST API │  │  │   │
 │  │  │  (LLM Infer) │  │  (repo data)     │  │  │   │
 │  │  └──────────────┘  └──────────────────┘  │  │   │
 │  │  ┌──────────────┐                         │  │   │
 │  │  │  Brevo SMTP  │                         │  │   │
 │  │  │  (email API) │                         │  │   │
 │  │  └──────────────┘                         │  │   │
 │  └──────────────────────────────────────────┘  │   │
 └─────────────────────────────────────────────────────┘
```

### Data Flow: Indexing Pipeline

```
GitHub Repository URL
        │
        ▼
  Clone / Fetch via GitHub API
        │
        ▼
  File Type Detection (py, js, ts, go, java, etc.)
        │
        ▼
  Language-Aware Chunking
  (functions, classes, modules — NOT fixed token windows)
        │
        ▼
  Embedding Generation
  (sentence-transformers/all-MiniLM-L6-v2)
        │
        ▼
  ChromaDB Vector Store
  (keyed by github_user + repo_name)
        │
        ▼
  Index Ready — All features now active ✅
```

### Data Flow: AI Query Pipeline

```
User Natural Language Query
        │
        ▼
  Vector Similarity Search (ChromaDB)
  → Returns top-k most relevant code chunks
        │
        ▼
  Prompt Assembly
  [System Prompt] + [Retrieved Code Context] + [User Query]
        │
        ▼
  Groq Cloud Inference (LLaMA 3.3 70B Versatile)
  → Low-latency, production-grade LLM response
        │
        ▼
  Streamed / Returned to Frontend
  → Rendered as Markdown with syntax highlighting
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| Vite | 5 | Build tool & dev server |
| Zustand | 4 | Global state management |
| React Router | 6 | Client-side routing |
| Framer Motion | 11 | Animations |
| Lucide React | Latest | Icon library |
| Sonner | Latest | Toast notifications |
| React Syntax Highlighter | Latest | Code rendering |
| React Markdown | Latest | Markdown rendering |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| FastAPI | 0.111 | REST API framework |
| Python | 3.11+ | Runtime |
| ChromaDB | 0.5 | Local vector store |
| sentence-transformers | Latest | Embedding generation |
| Groq SDK | Latest | LLM client |
| PyGithub | Latest | GitHub API client |
| Uvicorn | Latest | ASGI server |

### AI & External Services
| Service | Purpose |
|---|---|
| Groq Cloud (LLaMA 3.3 70B) | Primary LLM inference engine |
| sentence-transformers/all-MiniLM-L6-v2 | Code embedding model |
| GitHub REST API v3 | Repository access & commit history |
| Brevo | Transactional email (Help Center contact form) |

---

## 🚀 Installation & Setup

### Prerequisites
- Python 3.11 or higher
- Node.js 18 or higher
- A GitHub Personal Access Token (PAT) with `repo` scope
- A Groq Cloud API key (free at [console.groq.com](https://console.groq.com))

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/ASTraMind.git
cd ASTraMind
```

### 2. Backend Setup

```bash
cd astramind-backend

# Create a virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure environment variables (see next section)
cp .env.example .env
# Edit .env with your API keys

# Start the backend server
py -m uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd astramind-frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

### 4. Open the Application

Navigate to `http://localhost:5173` in your browser.

---

## ⚙️ Environment Variables

Create a `.env` file in `astramind-backend/` with the following variables:

```env
# ─────────────────────────────────────────
# AI Configuration
# ─────────────────────────────────────────
AI_ENV=production               # 'production' (Groq) or 'development' (Ollama)

# Groq Cloud (get free key at console.groq.com)
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# ─────────────────────────────────────────
# Email (Optional — for Help Center contact form)
# ─────────────────────────────────────────
BREVO_API_KEY=xkeysib-your_key_here

# ─────────────────────────────────────────
# Application Settings
# ─────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:5173
```

---

## 📡 API Reference

The backend exposes the following primary endpoints (all under `http://localhost:8000`):

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/index/repository` | Clone and index a GitHub repository |
| `GET` | `/index/repositories` | List all indexed repositories for a user |
| `POST` | `/search/semantic` | Semantic vector search across codebase |
| `POST` | `/search/answer` | Full AI Q&A with cited code context |
| `POST` | `/onboard/tour` | Generate role-based codebase tour |
| `POST` | `/onboard/explain` | Explain a specific file/code block |
| `POST` | `/security/scan` | Run OWASP vulnerability scan |
| `POST` | `/review/code` | AI code review for a file or snippet |
| `POST` | `/debug/analyze` | Debug analysis from error/stack trace |
| `POST` | `/deps/audit` | Dependency vulnerability audit |
| `POST` | `/diff/analyze` | Semantic diff analysis |
| `GET` | `/commits/list` | List and summarize recent commits |
| `POST` | `/trends/analyze` | Code quality trends over time |
| `POST` | `/tests/generate` | Auto-generate unit tests |
| `POST` | `/pair/chat` | Pair programming AI assistant |
| `POST` | `/adr/generate` | Generate Architecture Decision Records |
| `POST` | `/architecture/map` | Generate system architecture overview |
| `POST` | `/nl_query/execute` | Natural language to database query |
| `POST` | `/timemachine/query` | Query historical codebase state |
| `POST` | `/contact/send` | Send Help Center contact email |

Full interactive API docs available at `http://localhost:8000/docs` (Swagger UI).

---

## 🔮 Future Scope

ASTraMind Beta 1.0 is just the beginning. The roadmap includes:

### 🔐 Security & Authentication
- **Formal OAuth 2.0 Flow** — Replace PAT-based authentication with proper GitHub OAuth for enterprise-grade security and team management.
- **Team Workspaces** — Multi-user collaborative spaces where the entire team shares a single indexed knowledge base.
- **RBAC (Role-Based Access Control)** — Different permission levels for admins, developers, and read-only stakeholders.

### 💾 Infrastructure & Scalability
- **Cloud Vector Store (Qdrant/Pinecone)** — Migrate from local ChromaDB to a persistent, cloud-hosted vector database enabling multi-user concurrent access.
- **Repository Change Watching** — Automatically re-index when new commits are pushed via GitHub Webhooks, keeping the knowledge base perpetually fresh.
- **Containerization** — Docker Compose setup for one-command production deployment.

### 🧠 AI Capabilities
- **Multi-Modal Understanding** — Add support for diagrams, wireframes, and architecture images as additional context for AI reasoning.
- **Cross-Repository Intelligence** — Index and query multiple repositories simultaneously to understand microservice interactions.
- **Custom Model Fine-Tuning** — Allow teams to fine-tune a private model on their own codebase for maximum accuracy.
- **AI Code Review Automation** — Integrate directly with GitHub Pull Requests to auto-post AI review comments.

### 🎨 User Experience
- **VS Code Extension** — Bring ASTraMind's intelligence directly into the editor with a native extension.
- **Slack / Teams Integration** — Query the codebase directly from team chat with a `/astramind ask` slash command.
- **Collaborative Annotations** — Let team members annotate code sections with explanations that persist across sessions.
- **Mobile-Responsive Dashboard** — A fully responsive layout for on-the-go access.

### 📊 Analytics
- **Team Productivity Insights** — Track query patterns to identify knowledge gaps and areas of the codebase that need better documentation.
- **Onboarding Time Reports** — Measure and track how long it takes new engineers to reach productivity milestones.

---

## 🤝 Contributing

We welcome contributions from the community! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

Please read our [Contributing Guidelines](CONTRIBUTING.md) and ensure all PRs include tests where applicable.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by the ASTraMind Team**

*Making large codebases navigable for every engineer on earth.*

[🌐 Website](https://astramind.dev) · [📧 Contact](mailto:support@astramind.dev) · [🐛 Issues](https://github.com/yourusername/ASTraMind/issues)

</div>
