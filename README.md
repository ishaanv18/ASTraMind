# 🚀 ASTraMind - AI-Powered Codebase Intelligence Platform

> **Transform your codebase into an intelligent, searchable knowledge base with AI-powered analysis and natural language querying.**

[![Java](https://img.shields.io/badge/Java-17+-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.0-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Groq](https://img.shields.io/badge/AI-Groq%20LLaMA-red.svg)](https://groq.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue.svg)](https://www.postgresql.org/)

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Solution](#-solution)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [How It Works](#-how-it-works)
- [Installation](#-installation)
- [Deployment](#-deployment)
- [Usage](#-usage)
- [Future Scope](#-future-scope)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Problem Statement

### The Challenge

Modern software development faces several critical challenges:

1. **Codebase Complexity**: Large codebases become increasingly difficult to understand and navigate
2. **Knowledge Silos**: Critical code knowledge is often locked in developers' minds
3. **Onboarding Friction**: New developers spend weeks understanding existing code
4. **Manual Code Review**: Time-consuming manual analysis of code quality and dependencies
5. **Limited Search**: Traditional text search fails to understand semantic meaning and context
6. **Documentation Gaps**: Code documentation is often outdated or incomplete

### Real-World Impact

- 🕐 **40% of developer time** spent understanding existing code
- 📈 **3-6 months** average onboarding time for complex projects
- 💰 **$100B+ annually** lost to poor code comprehension
- 🔍 **Limited visibility** into code quality, dependencies, and technical debt

---

## 💡 Solution

**ASTraMind** is an AI-powered codebase intelligence platform that transforms how developers interact with code. By combining **Abstract Syntax Tree (AST) parsing**, **vector embeddings**, and **large language models (LLMs)**, ASTraMind creates an intelligent, queryable knowledge base from your codebase.

### What Makes ASTraMind Different?

✅ **Natural Language Queries**: Ask questions in plain English, get accurate answers  
✅ **Deep Code Understanding**: AST-level parsing for precise code analysis  
✅ **Semantic Search**: Find code by meaning, not just keywords  
✅ **AI-Powered Insights**: Get explanations, suggestions, and refactoring recommendations  
✅ **Visual Dependency Graphs**: Understand code relationships at a glance  
✅ **Production-Ready**: Hybrid AI architecture for local development and cloud deployment  

---

## ✨ Key Features

### 🤖 AI-Powered Chat Assistant
- Ask questions about your codebase in natural language
- Get context-aware responses powered by Groq LLaMA AI
- Understand code architecture, design patterns, and best practices
- Receive refactoring suggestions and code improvement recommendations

### 🔍 Semantic Code Search
- Search code using natural language queries
- RAG (Retrieval-Augmented Generation) system for context-aware results
- Find relevant classes and methods based on semantic similarity
- Vector embeddings for lightning-fast similarity search

### 📊 AST Parsing & Analysis
- Deep code analysis with Abstract Syntax Tree parsing
- Extract classes, methods, fields, and relationships automatically
- Analyze code complexity and quality metrics
- Identify design patterns and anti-patterns

### 🌐 Dependency Visualization
- Interactive dependency graphs showing class relationships
- Visualize inheritance hierarchies and method calls
- Understand code coupling and cohesion
- Identify circular dependencies and code smells

### 📈 Real-Time Metrics
- Track codebase metrics including complexity and file counts
- Monitor class distributions and embedding statistics
- Analyze code quality trends over time
- Generate comprehensive code quality reports

### 🔐 GitHub Integration
- Seamless OAuth authentication
- Connect and analyze GitHub repositories
- Track repository metadata and statistics
- Automatic codebase synchronization

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────┐
│                 User (Browser)                       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────┐
│        Frontend (Vercel - React + Vite)              │
│        • Modern UI with animations                   │
│        • Real-time updates                           │
│        • Responsive design                           │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
                       ▼
┌─────────────────────────────────────────────────────┐
│     Backend (Render - Spring Boot)                   │
│  ┌────────────────────────────────────────────┐    │
│  │  Controllers Layer                          │    │
│  │  • AIAssistantController                    │    │
│  │  • CodebaseController                       │    │
│  │  • EmbeddingController                      │    │
│  └────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────┐    │
│  │  Services Layer                             │    │
│  │  • AIServiceFactory (Provider Abstraction)  │    │
│  │  • RAGService (Semantic Search)             │    │
│  │  • ASTParserService (Code Analysis)         │    │
│  │  • EmbeddingService (Vector Generation)     │    │
│  └────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────┐    │
│  │  AI Provider Layer                          │    │
│  │  • GroqService (Production)                 │    │
│  │  • OllamaService (Local Development)        │    │
│  └────────────────────────────────────────────┘    │
└──────────────┬──────────────────┬────────────────────┘
               │                  │
               ▼                  ▼
┌──────────────────────┐  ┌──────────────────────┐
│  PostgreSQL DB       │  │   Groq API Cloud     │
│  (Render Managed)    │  │  • LLaMA 3.3 70B     │
│  • Codebases         │  │  • Ultra-fast ⚡     │
│  • Classes           │  │  • Free tier         │
│  • Methods           │  │  • No GPU needed     │
│  • Embeddings        │  │                      │
│  • Relationships     │  │                      │
└──────────────────────┘  └──────────────────────┘
```

### Hybrid AI Architecture

ASTraMind uses a **provider-agnostic AI architecture** that switches between different AI providers based on the environment:

```
┌─────────────────────────────────────┐
│      AIServiceFactory               │
│      (Provider Abstraction)         │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│ OllamaService│  │ GroqService │
│  (Local Dev) │  │ (Production)│
│              │  │             │
│ DeepSeek     │  │ LLaMA 3.3   │
│ Coder 6.7B   │  │ 70B         │
└─────────────┘  └─────────────┘
```

**Benefits:**
- 🏠 **Local Development**: Fast iteration with Ollama
- ☁️ **Production**: Cloud-hosted Groq for scalability
- 🔄 **Portable**: Easy to switch AI providers
- 💰 **Cost-Effective**: Free tiers for both environments

---

## 🛠️ Technology Stack

### Frontend
- **React 18.2** - Modern UI library
- **Vite** - Lightning-fast build tool
- **Framer Motion** - Smooth animations
- **React Flow** - Interactive dependency graphs
- **Axios** - HTTP client
- **React Router** - Client-side routing

### Backend
- **Spring Boot 3.2** - Enterprise Java framework
- **Java 17** - Modern Java features
- **PostgreSQL** - Relational database
- **Hibernate** - ORM framework
- **JavaParser** - AST parsing library
- **Spring Security** - Authentication & authorization

### AI & ML
- **Groq API** - Cloud LLM (LLaMA 3.3 70B)
- **Ollama** - Local LLM (DeepSeek-Coder 6.7B)
- **Vector Embeddings** - Semantic search
- **RAG System** - Retrieval-Augmented Generation

### DevOps & Deployment
- **Render** - Backend & database hosting
- **Vercel** - Frontend hosting
- **GitHub Actions** - CI/CD (future)
- **Docker** - Containerization (future)

---

## ⚙️ How It Works

### 1. Repository Connection
```
User connects GitHub repository
         ↓
Backend clones repository
         ↓
AST Parser analyzes Java files
         ↓
Extract classes, methods, fields
         ↓
Store in PostgreSQL database
```

### 2. Embedding Generation
```
For each class/method
         ↓
Generate text representation
         ↓
Create vector embedding (384-dim)
         ↓
Store in database with metadata
         ↓
Enable semantic search
```

### 3. AI-Powered Query
```
User asks question
         ↓
RAG System retrieves relevant code
         ↓
Build context from embeddings
         ↓
Send to Groq LLaMA
         ↓
Generate intelligent response
         ↓
Display with code references
```

### 4. Semantic Search
```
User enters search query
         ↓
Generate query embedding
         ↓
Calculate cosine similarity
         ↓
Rank results by relevance
         ↓
Return top matches
```

---

## 📦 Installation

### Prerequisites

- **Java 17+**
- **Node.js 18+**
- **PostgreSQL 14+**
- **Maven 3.8+**
- **Git**

### Local Development Setup

#### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/astramind.git
cd astramind
```

#### 2. Database Setup

```bash
# Create PostgreSQL database
createdb astramind

# Update backend/src/main/resources/application.properties
spring.datasource.url=jdbc:postgresql://localhost:5432/astramind
spring.datasource.username=postgres
spring.datasource.password=your_password
```

#### 3. Backend Setup

```bash
cd backend

# Install dependencies and build
mvn clean install

# Run backend
mvn spring-boot:run
```

Backend will start on `http://localhost:8080`

#### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will start on `http://localhost:5173`

#### 5. Configure AI Provider

For local development with Ollama:

```bash
# Install Ollama
# Visit: https://ollama.ai

# Pull DeepSeek-Coder model
ollama pull deepseek-coder:6.7b

# Update application.properties
ai.provider=ollama
```

For production with Groq:

```bash
# Get Groq API key from https://console.groq.com

# Update application.properties
ai.provider=groq
groq.api.key=your_groq_api_key
```

#### 6. GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create new OAuth App
3. Set callback URL: `http://localhost:8080/api/auth/github/callback`
4. Update `application.properties`:

```properties
github.oauth.client-id=your_client_id
github.oauth.client-secret=your_client_secret
```

---

## 🚀 Deployment

### Production Deployment (Render + Vercel)

Detailed deployment guide available in [`deployment_guide.md`](./deployment_guide.md)

**Quick Overview:**

1. **Database**: Create Render PostgreSQL
2. **Backend**: Deploy to Render with environment variables
3. **Frontend**: Deploy to Vercel with API URL
4. **Configure**: Update GitHub OAuth and CORS

**Environment Variables (Backend):**
```
DATABASE_URL=jdbc:postgresql://...
GROQ_API_KEY=gsk_...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
FRONTEND_URL=https://astramind.vercel.app
SPRING_PROFILES_ACTIVE=prod
```

**Environment Variables (Frontend):**
```
VITE_API_BASE_URL=https://astramind-backend.onrender.com/api
```

---

## 📖 Usage

### 1. Login with GitHub
- Click "Login with GitHub" on homepage
- Authorize ASTraMind to access your repositories

### 2. Connect Repository
- Navigate to "Codebases" page
- Click "Connect Repository"
- Select a Java repository from your GitHub account
- ASTraMind will clone and analyze the code

### 3. Explore Codebase
- View codebase statistics and metrics
- Browse classes, methods, and dependencies
- Visualize dependency graphs
- Analyze code complexity

### 4. Ask AI Questions
- Click "AI Assistant" for any codebase
- Ask questions in natural language:
  - "What design patterns are used in this codebase?"
  - "Explain the authentication flow"
  - "How can I improve the UserService class?"
  - "What are the main dependencies of OrderController?"

### 5. Semantic Search
- Use the search feature to find code by meaning
- Search for "database connection logic"
- Find "error handling patterns"
- Discover "API endpoints for user management"

---

## 🔮 Future Scope

### Short-Term Enhancements

- [ ] **Multi-Language Support**: Python, JavaScript, TypeScript
- [ ] **Code Diff Analysis**: Compare versions and track changes
- [ ] **Custom Embeddings**: Fine-tuned models for specific domains
- [ ] **Batch Processing**: Analyze multiple repositories simultaneously
- [ ] **Export Reports**: PDF/HTML code quality reports

### Medium-Term Features

- [ ] **Real-Time Collaboration**: Multi-user code review sessions
- [ ] **CI/CD Integration**: Automated code analysis in pipelines
- [ ] **IDE Plugins**: VS Code, IntelliJ IDEA extensions
- [ ] **Code Generation**: AI-powered code suggestions
- [ ] **Refactoring Assistant**: Automated code improvements

### Long-Term Vision

- [ ] **Enterprise Features**: Team management, role-based access
- [ ] **Advanced Analytics**: ML-powered code quality predictions
- [ ] **Security Analysis**: Vulnerability detection and fixes
- [ ] **Performance Profiling**: Identify bottlenecks and optimizations
- [ ] **Knowledge Graph**: Visual representation of codebase knowledge

---

## 🎯 Use Cases

### For Developers
- 🚀 **Faster Onboarding**: Understand new codebases quickly
- 🔍 **Efficient Debugging**: Find relevant code instantly
- 💡 **Learning**: Understand design patterns and best practices
- ✨ **Code Quality**: Get AI-powered improvement suggestions

### For Teams
- 📊 **Code Reviews**: Automated quality analysis
- 📈 **Technical Debt**: Track and manage code health
- 🤝 **Knowledge Sharing**: Democratize code understanding
- 🎓 **Training**: Onboard new developers faster

### For Organizations
- 💰 **Cost Reduction**: Reduce time spent on code comprehension
- 📉 **Risk Mitigation**: Identify potential issues early
- 🔄 **Modernization**: Understand legacy codebases for migration
- 📊 **Metrics**: Data-driven development decisions

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow Java and React best practices
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Your Name**
- GitHub: [@yourusername](https://github.com/yourusername)
- LinkedIn: [Your LinkedIn](https://linkedin.com/in/yourprofile)
- Email: your.email@example.com

---

## 🙏 Acknowledgments

- **Groq** - For providing ultra-fast LLM inference
- **Ollama** - For local AI model hosting
- **Spring Boot** - For the robust backend framework
- **React** - For the modern frontend library
- **JavaParser** - For AST parsing capabilities

---

## 📊 Project Stats

- **Lines of Code**: ~15,000+
- **Languages**: Java, JavaScript, SQL
- **API Endpoints**: 25+
- **Database Tables**: 8
- **AI Models**: 2 (Groq LLaMA, Ollama DeepSeek)

---

## 🔗 Links

- **Live Demo**: [astramind.vercel.app](https://astramind.vercel.app)
- **Documentation**: [docs](./docs)
- **Deployment Guide**: [deployment_guide.md](./deployment_guide.md)
- **API Documentation**: [API Docs](./docs/api.md)

---

<div align="center">

**⭐ Star this repository if you find it helpful!**

Made with ❤️ by developers, for developers

</div>
