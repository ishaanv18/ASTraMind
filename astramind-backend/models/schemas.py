"""
models/schemas.py — All Pydantic request/response schemas for Astramind.
Every router imports its models from here. Never define schemas inside router files.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


# ══════════════════════════════════════════════════════════════════════════════
# COMMON / SHARED
# ══════════════════════════════════════════════════════════════════════════════

class HealthResponse(BaseModel):
    status: str
    ai_env: str
    db_env: str
    ai_available: bool
    version: str


class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 1 — Codebase Ingestion & Indexing
# ══════════════════════════════════════════════════════════════════════════════

class IndexRepositoryRequest(BaseModel):
    repo_path: Optional[str] = Field(None, description="Absolute local path to a repository")
    github_url: Optional[str] = Field(None, description="GitHub URL to clone and index")
    repo_name: str = Field(..., description="Human-readable repository name")
    github_user: Optional[str] = Field(None, description="GitHub login of the user performing the index")


class IndexRepositoryResponse(BaseModel):
    repo_id: str
    message: str
    status_url: str


class IndexStatusResponse(BaseModel):
    repo_id: str
    status: str  # pending | running | completed | failed
    percent: float
    files_done: int
    total_files: int
    message: Optional[str] = None
    error: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 2 — Semantic Search & Q&A
# ══════════════════════════════════════════════════════════════════════════════

class SearchResultItem(BaseModel):
    file_path: str
    function_name: Optional[str] = None
    content: str
    score: float
    language: Optional[str] = None


class SearchResponse(BaseModel):
    query: str
    repo_id: str
    results: List[SearchResultItem]
    total: int


class AskRequest(BaseModel):
    question: str = Field(..., description="Natural language question about the codebase")
    repo_id: str


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 3 — Multi-Agent Debugging
# ══════════════════════════════════════════════════════════════════════════════

class DebugAnalyzeRequest(BaseModel):
    error_message: str
    stack_trace: Optional[str] = Field(default="", description="Full stack trace text")
    repo_id: Optional[str] = Field(default="", description="Repository ID")
    affected_file: Optional[str] = Field(None, description="Relative file path if known")
    # Optional: pre-computed agent results passed from frontend to /synthesize
    agent_1_logic: Optional[str] = None
    agent_2_runtime: Optional[str] = None
    agent_3_config: Optional[str] = None


class DebugAgentResult(BaseModel):
    agent_name: str
    analysis: str


class DebugAnalyzeResponse(BaseModel):
    repo_id: str
    error_message: str
    agent_1_logic: str
    agent_2_runtime: str
    agent_3_config: str
    synthesis_stream_url: str


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 4 — Semantic PR Diff Analysis
# ══════════════════════════════════════════════════════════════════════════════

class DiffAnalyzeRequest(BaseModel):
    repo_id: Optional[str] = None
    base_branch: Optional[str] = Field(None, description="e.g. main")
    compare_branch: Optional[str] = Field(None, description="e.g. feature/auth")
    diff_text: Optional[str] = Field(None, description="Raw unified diff string")


class PRDescriptionRequest(BaseModel):
    repo_id: Optional[str] = None
    diff_text: str


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 5 — Dependency Risk Radar
# ══════════════════════════════════════════════════════════════════════════════

class DepsAnalyzeRequest(BaseModel):
    repo_id: Optional[str] = None
    file_content: Optional[str] = Field(None, description="Raw content of requirements.txt / package.json / pyproject.toml")
    file_type: Optional[str] = Field(None, description="requirements | package_json | pyproject")


class DependencyInfo(BaseModel):
    name: str
    current_version: Optional[str] = None
    latest_version: Optional[str] = None
    license: Optional[str] = None
    last_release_date: Optional[str] = None
    cves: List[Dict[str, Any]] = Field(default_factory=list)
    days_since_release: Optional[int] = None


class DepsAnalyzeResponse(BaseModel):
    dependencies: List[DependencyInfo]
    total: int


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 6 — Architecture Guardian
# ══════════════════════════════════════════════════════════════════════════════

class ArchitectureCheckRequest(BaseModel):
    repo_id: str
    new_code: str = Field(..., description="New code to check against codebase patterns")
    new_file_path: str = Field(..., description="Intended path for the new file")


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 7 — Onboarding Copilot
# ══════════════════════════════════════════════════════════════════════════════

class OnboardTourRequest(BaseModel):
    repo_id: str
    role: str = Field(..., description="frontend | backend | fullstack | devops | new")


class OnboardExplainRequest(BaseModel):
    repo_id: str
    file_path: str
    line_start: int
    line_end: int


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 8 — Security Sentinel
# ══════════════════════════════════════════════════════════════════════════════

class SecurityScanRequest(BaseModel):
    repo_id: Optional[str] = None
    code: Optional[str] = Field(None, description="Raw code snippet to scan")
    language: Optional[str] = Field(None, description="Language of the snippet")


class SecurityFinding(BaseModel):
    file_path: str
    line_number: int
    severity: str  # LOW | MEDIUM | HIGH | CRITICAL
    cwe_id: str
    description: str
    match: str


class SecurityScanResponse(BaseModel):
    repo_id: Optional[str] = None
    findings: List[SecurityFinding]
    risk_score: int
    total_findings: int
    ai_summary: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 9 — Test Intelligence Engine
# ══════════════════════════════════════════════════════════════════════════════

class TestGenerateRequest(BaseModel):
    repo_id: Optional[str] = None
    target_file_path: Optional[str] = None
    code_snippet: Optional[str] = None
    language: Optional[str] = None


class StaleTestRequest(BaseModel):
    repo_id: str


class StaleTestItem(BaseModel):
    test_file: str
    test_function: str
    reason: str
    original_function: Optional[str] = None


class StaleTestResponse(BaseModel):
    repo_id: str
    stale_tests: List[StaleTestItem]
    total: int


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 10 — Inline Code Review
# ══════════════════════════════════════════════════════════════════════════════

class InlineReviewRequest(BaseModel):
    repo_id: str
    file_path: str
    code: str
    cursor_line: Optional[int] = None


class ReviewChatRequest(BaseModel):
    repo_id: str
    conversation_id: Optional[str] = None
    message: str


class ReviewChatResponse(BaseModel):
    conversation_id: str
    repo_id: str


# ══════════════════════════════════════════════════════════════════════════════
# ADVANCED 1 — Code Time Machine
# ══════════════════════════════════════════════════════════════════════════════

class TimeMachineRequest(BaseModel):
    repo_id: str
    question: str
    as_of_date: str = Field(..., description="YYYY-MM-DD format date")


class TimeMachineResponse(BaseModel):
    repo_id: str
    as_of_date: str
    question: str
    historical_answer: str
    current_answer: str


# ══════════════════════════════════════════════════════════════════════════════
# ADVANCED 2 — Code Quality Trend Tracker
# ══════════════════════════════════════════════════════════════════════════════

class QualityTrendRequest(BaseModel):
    repo_id: str
    days_back: int = Field(default=30, ge=1, le=365)


class QualityMetricPoint(BaseModel):
    date: str
    commit_hash: str
    avg_function_length: float
    cyclomatic_complexity: float
    todo_count: int
    undocumented_functions: int
    duplicate_blocks: int


class QualityTrendResponse(BaseModel):
    repo_id: str
    days_back: int
    time_series: List[QualityMetricPoint]


# ══════════════════════════════════════════════════════════════════════════════
# ADVANCED 3 — Natural Language Code Query
# ══════════════════════════════════════════════════════════════════════════════

class NLQueryRequest(BaseModel):
    repo_id: str
    query: str = Field(..., description="e.g. 'find all async functions without error handling'")


class NLQueryResultItem(BaseModel):
    file_path: str
    function_name: Optional[str] = None
    code_snippet: str
    match_reason: str
    relevance_score: float


class NLQueryResponse(BaseModel):
    repo_id: str
    query: str
    intent_type: str
    results: List[NLQueryResultItem]
    total: int


# ══════════════════════════════════════════════════════════════════════════════
# ADVANCED 4 — Auto ADR Generator
# ══════════════════════════════════════════════════════════════════════════════

class ADRGenerateRequest(BaseModel):
    repo_id: str


class ADRDocument(BaseModel):
    title: str
    filename: str
    content: str
    inferred_date: str
    confidence_score: float


class ADRGenerateResponse(BaseModel):
    repo_id: str
    adrs: List[ADRDocument]
    folder_structure: Dict[str, str]
    total: int


# ══════════════════════════════════════════════════════════════════════════════
# ADVANCED 5 — Pair Programming Chat
# ══════════════════════════════════════════════════════════════════════════════

class PairChatRequest(BaseModel):
    repo_id: str
    message: str
    conversation_id: Optional[str] = None


class PairChatResponse(BaseModel):
    conversation_id: str
    repo_id: str


class ConversationSummary(BaseModel):
    id: str
    repo_id: str
    title: str
    message_count: int
    created_at: str
    updated_at: str


class ConversationsListResponse(BaseModel):
    repo_id: str
    conversations: List[ConversationSummary]
    total: int


# ══════════════════════════════════════════════════════════════════════════════
# ADVANCED 6 — Smart Commit Message Generator
# ══════════════════════════════════════════════════════════════════════════════

class CommitMessageRequest(BaseModel):
    repo_id: str
    diff_text: Optional[str] = Field(None, description="Raw diff text; omit to auto-read staged changes")


class CommitMessageResponse(BaseModel):
    subject: str
    body: str
    breaking_changes: str
    issue_keywords: str


class CommitHistoryAnalysisRequest(BaseModel):
    repo_id: str
    limit: int = Field(default=50, ge=1, le=500)


class CommitHistoryAnalysisResponse(BaseModel):
    repo_id: str
    quality_score: int
    issues: List[str]
    recommendations: List[str]
    commits_analyzed: int


# ══════════════════════════════════════════════════════════════════════════════
# DATABASE INTERNAL SCHEMAS (used by database_client.py)
# ══════════════════════════════════════════════════════════════════════════════

class RepositoryRecord(BaseModel):
    id: str
    name: str
    repo_path: str
    language_summary: Dict[str, int]
    total_files: int
    total_functions: int
    indexed_at: Optional[str] = None
    created_at: str


class IndexedFileRecord(BaseModel):
    id: str
    repo_id: str
    file_path: str
    language: str
    function_count: int
    chunk_count: int
    last_modified: Optional[str] = None
    indexed_at: str


class ConversationRecord(BaseModel):
    id: str
    repo_id: str
    title: str
    messages: List[Dict[str, Any]]
    created_at: str
    updated_at: str


class Message(BaseModel):
    role: str  # user | assistant | system
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
