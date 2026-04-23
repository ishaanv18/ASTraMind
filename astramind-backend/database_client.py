"""
database_client.py — Astramind Database Client
DB_ENV=development → SQLite + aiosqlite (zero setup, local file)
DB_ENV=production  → Supabase Postgres + asyncpg (free 500MB tier)

All routers call only the methods on this class — never touch SQLAlchemy directly.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    event,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.future import select
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.pool import NullPool

from config import settings

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# SQLAlchemy ORM Base
# ══════════════════════════════════════════════════════════════════════════════

class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


# ══════════════════════════════════════════════════════════════════════════════
# ORM Models
# ══════════════════════════════════════════════════════════════════════════════

class Repository(Base):
    __tablename__ = "repositories"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(255), nullable=False)
    repo_path = Column(Text, nullable=False)
    github_user = Column(String(255), nullable=True, index=True)  # owner GitHub login
    language_summary = Column(JSON, default=dict)
    total_files = Column(Integer, default=0)
    total_functions = Column(Integer, default=0)
    indexed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    files = relationship("IndexedFile", back_populates="repository", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="repository", cascade="all, delete-orphan")
    quality_metrics = relationship("QualityMetric", back_populates="repository", cascade="all, delete-orphan")
    security_scans = relationship("SecurityScan", back_populates="repository", cascade="all, delete-orphan")
    patterns = relationship("RepoPattern", back_populates="repository", cascade="all, delete-orphan")


class IndexedFile(Base):
    __tablename__ = "indexed_files"

    id = Column(String(36), primary_key=True, default=_uuid)
    repo_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(Text, nullable=False)
    language = Column(String(64), nullable=True)
    function_count = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    last_modified = Column(DateTime, nullable=True)
    indexed_at = Column(DateTime, default=_now)

    repository = relationship("Repository", back_populates="files")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=_uuid)
    repo_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(512), default="New conversation")
    messages = Column(JSON, default=list)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    repository = relationship("Repository", back_populates="conversations")


class QualityMetric(Base):
    __tablename__ = "quality_metrics"

    id = Column(String(36), primary_key=True, default=_uuid)
    repo_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    commit_hash = Column(String(40), nullable=True)
    commit_date = Column(DateTime, nullable=True)
    avg_function_length = Column(Float, default=0.0)
    cyclomatic_complexity = Column(Float, default=0.0)
    todo_count = Column(Integer, default=0)
    undocumented_functions = Column(Integer, default=0)
    duplicate_blocks = Column(Integer, default=0)
    recorded_at = Column(DateTime, default=_now)

    repository = relationship("Repository", back_populates="quality_metrics")


class SecurityScan(Base):
    __tablename__ = "security_scans"

    id = Column(String(36), primary_key=True, default=_uuid)
    repo_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    findings = Column(JSON, default=list)
    risk_score = Column(Integer, default=0)
    scanned_at = Column(DateTime, default=_now)

    repository = relationship("Repository", back_populates="security_scans")


class RepoPattern(Base):
    __tablename__ = "repo_patterns"

    id = Column(String(36), primary_key=True, default=_uuid)
    repo_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    pattern_type = Column(String(128), nullable=False)
    description = Column(Text, nullable=False)
    example_file = Column(Text, nullable=True)

    repository = relationship("Repository", back_populates="patterns")


# ══════════════════════════════════════════════════════════════════════════════
# DatabaseClient
# ══════════════════════════════════════════════════════════════════════════════

class DatabaseClient:
    """
    Async database client. Uses SQLAlchemy with:
    - aiosqlite in development
    - asyncpg in production (Supabase Postgres)
    """

    def __init__(self) -> None:
        self._env = settings.DB_ENV.lower()

        if self._env == "production":
            db_url = settings.DATABASE_URL
            # ── Neon PostgreSQL — direct connection, no PgBouncer ────────────────
            # Neon supports full asyncpg feature set including prepared statements.
            # A small QueuePool keeps 2 warm connections to avoid per-request
            # TCP handshake overhead, while staying within Neon free tier limits.
            self.engine = create_async_engine(
                db_url,
                pool_size=2,        # 2 persistent warm connections
                max_overflow=3,     # up to 5 total under load
                pool_pre_ping=True, # drop stale connections automatically
                pool_recycle=300,   # recycle every 5 min to avoid server-side timeouts
                echo=False,
                future=True,
            )
            logger.info("DatabaseClient: PRODUCTION mode (Neon Postgres)")
        else:
            db_url = "sqlite+aiosqlite:///./astramind.db"
            self.engine = create_async_engine(
                db_url,
                connect_args={"check_same_thread": False},
                echo=False,
                future=True,
                pool_pre_ping=True,
                pool_recycle=300,
            )
            logger.info("DatabaseClient: DEVELOPMENT mode (SQLite)")

        # Enable WAL mode for SQLite to support concurrent reads
        if self._env != "production":
            @event.listens_for(self.engine.sync_engine, "connect")
            def set_sqlite_pragma(dbapi_conn, connection_record):
                cursor = dbapi_conn.cursor()
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()

        self.AsyncSessionLocal = async_sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

    # ── Startup ───────────────────────────────────────────────────────────────

    async def create_all_tables(self) -> None:
        """Create all tables if they don't exist. Safe to call on every startup."""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        # Safe migration: add github_user column if it doesn't exist yet (SQLite)
        if self._env != "production":
            try:
                async with self.engine.begin() as conn:
                    await conn.execute(text("ALTER TABLE repositories ADD COLUMN github_user VARCHAR(255)"))
                logger.info("Migration: added github_user column to repositories.")
            except Exception:
                pass  # Column already exists — no-op
        logger.info("Database tables verified/created.")

    async def init(self) -> None:
        """Alias for create_all_tables — called from main.py startup."""
        await self.create_all_tables()

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _row_to_dict(self, obj: Any) -> Dict[str, Any]:
        """Convert a SQLAlchemy ORM object to a serialisable dict."""
        result: Dict[str, Any] = {}
        for col in obj.__table__.columns:
            val = getattr(obj, col.name)
            if isinstance(val, datetime):
                val = val.isoformat()
            result[col.name] = val
        return result

    # ══════════════════════════════════════════════════════════════════════════
    # Repository methods
    # ══════════════════════════════════════════════════════════════════════════

    async def save_repository(self, repo_data: Dict[str, Any]) -> str:
        """Insert or update a repository record. Returns repo_id."""
        async with self.AsyncSessionLocal() as session:
            repo_id = repo_data.get("id") or _uuid()
            stmt = await session.execute(
                select(Repository).where(Repository.id == repo_id)
            )
            existing = stmt.scalars().first()
            if existing:
                for key, value in repo_data.items():
                    if hasattr(existing, key):
                        setattr(existing, key, value)
                existing.indexed_at = _now()
            else:
                repo = Repository(
                    id=repo_id,
                    name=repo_data.get("name", ""),
                    repo_path=repo_data.get("repo_path", ""),
                    github_user=repo_data.get("github_user"),
                    language_summary=repo_data.get("language_summary", {}),
                    total_files=repo_data.get("total_files", 0),
                    total_functions=repo_data.get("total_functions", 0),
                    indexed_at=_now(),
                    created_at=_now(),
                )
                session.add(repo)
            await session.commit()
            return repo_id

    async def get_repository(self, repo_id: str) -> Optional[Dict[str, Any]]:
        async with self.AsyncSessionLocal() as session:
            result = await session.execute(
                select(Repository).where(Repository.id == repo_id)
            )
            repo = result.scalars().first()
            return self._row_to_dict(repo) if repo else None
    async def delete_repository(self, repo_id: str) -> None:
        """Delete a repository and all its cascaded records (files, etc.)."""
        async with self.AsyncSessionLocal() as session:
            stmt = await session.execute(
                select(Repository).where(Repository.id == repo_id)
            )
            repo = stmt.scalars().first()
            if repo:
                await session.delete(repo)
                await session.commit()

    async def list_repositories(self, github_user: Optional[str] = None) -> List[Dict[str, Any]]:
        async with self.AsyncSessionLocal() as session:
            stmt = select(Repository).order_by(Repository.created_at.desc())
            if github_user:
                stmt = stmt.where(Repository.github_user == github_user)
            result = await session.execute(stmt)
            repos = result.scalars().all()
            return [self._row_to_dict(r) for r in repos]

    # ══════════════════════════════════════════════════════════════════════════
    # Indexed file methods
    # ══════════════════════════════════════════════════════════════════════════

    async def save_indexed_file(self, file_data: Dict[str, Any]) -> None:
        async with self.AsyncSessionLocal() as session:
            file_id = file_data.get("id") or _uuid()
            stmt = await session.execute(
                select(IndexedFile).where(
                    IndexedFile.repo_id == file_data["repo_id"],
                    IndexedFile.file_path == file_data["file_path"],
                )
            )
            existing = stmt.scalars().first()
            if existing:
                existing.function_count = file_data.get("function_count", 0)
                existing.chunk_count = file_data.get("chunk_count", 0)
                existing.language = file_data.get("language", "")
                existing.indexed_at = _now()
            else:
                f = IndexedFile(
                    id=file_id,
                    repo_id=file_data["repo_id"],
                    file_path=file_data["file_path"],
                    language=file_data.get("language", ""),
                    function_count=file_data.get("function_count", 0),
                    chunk_count=file_data.get("chunk_count", 0),
                    last_modified=file_data.get("last_modified"),
                    indexed_at=_now(),
                )
                session.add(f)
            await session.commit()

    async def save_indexed_files_bulk(self, files: List[Dict[str, Any]]) -> None:
        """
        Insert or update many IndexedFile rows in a SINGLE transaction.
        Orders of magnitude faster than calling save_indexed_file() per file,
        because we open only ONE database connection for the whole batch.
        """
        if not files:
            return
        now = _now()
        async with self.AsyncSessionLocal() as session:
            for file_data in files:
                stmt = await session.execute(
                    select(IndexedFile).where(
                        IndexedFile.repo_id == file_data["repo_id"],
                        IndexedFile.file_path == file_data["file_path"],
                    )
                )
                existing = stmt.scalars().first()
                if existing:
                    existing.function_count = file_data.get("function_count", 0)
                    existing.chunk_count    = file_data.get("chunk_count", 0)
                    existing.language       = file_data.get("language", "")
                    existing.indexed_at     = now
                else:
                    session.add(IndexedFile(
                        id             = _uuid(),
                        repo_id        = file_data["repo_id"],
                        file_path      = file_data["file_path"],
                        language       = file_data.get("language", ""),
                        function_count = file_data.get("function_count", 0),
                        chunk_count    = file_data.get("chunk_count", 0),
                        last_modified  = file_data.get("last_modified"),
                        indexed_at     = now,
                    ))
            await session.commit()

    async def get_indexed_files(self, repo_id: str) -> List[Dict[str, Any]]:
        async with self.AsyncSessionLocal() as session:
            result = await session.execute(
                select(IndexedFile).where(IndexedFile.repo_id == repo_id)
            )
            files = result.scalars().all()
            return [self._row_to_dict(f) for f in files]


    # ══════════════════════════════════════════════════════════════════════════
    # Conversation methods
    # ══════════════════════════════════════════════════════════════════════════

    async def save_conversation(self, conv_data: Dict[str, Any]) -> str:
        async with self.AsyncSessionLocal() as session:
            conv_id = conv_data.get("id") or _uuid()
            conv = Conversation(
                id=conv_id,
                repo_id=conv_data["repo_id"],
                title=conv_data.get("title", "New conversation"),
                messages=conv_data.get("messages", []),
                created_at=_now(),
                updated_at=_now(),
            )
            session.add(conv)
            await session.commit()
            return conv_id

    async def get_conversation(self, conv_id: str) -> Optional[Dict[str, Any]]:
        async with self.AsyncSessionLocal() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.id == conv_id)
            )
            conv = result.scalars().first()
            return self._row_to_dict(conv) if conv else None

    async def update_conversation(self, conv_id: str, messages: List[Dict]) -> None:
        async with self.AsyncSessionLocal() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.id == conv_id)
            )
            conv = result.scalars().first()
            if conv:
                conv.messages = messages
                conv.updated_at = _now()
                # Derive title from first user message if still default
                if conv.title == "New conversation" and messages:
                    first_user = next(
                        (m["content"][:60] for m in messages if m.get("role") == "user"),
                        "Untitled",
                    )
                    conv.title = first_user
                await session.commit()

    async def list_conversations(self, repo_id: str) -> List[Dict[str, Any]]:
        async with self.AsyncSessionLocal() as session:
            result = await session.execute(
                select(Conversation)
                .where(Conversation.repo_id == repo_id)
                .order_by(Conversation.updated_at.desc())
            )
            convs = result.scalars().all()
            return [self._row_to_dict(c) for c in convs]

    async def delete_conversation(self, conv_id: str) -> None:
        async with self.AsyncSessionLocal() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.id == conv_id)
            )
            conv = result.scalars().first()
            if conv:
                await session.delete(conv)
                await session.commit()

    # ══════════════════════════════════════════════════════════════════════════
    # Quality metric methods
    # ══════════════════════════════════════════════════════════════════════════

    async def save_quality_metrics(self, metrics: Dict[str, Any]) -> None:
        async with self.AsyncSessionLocal() as session:
            m = QualityMetric(
                id=_uuid(),
                repo_id=metrics["repo_id"],
                commit_hash=metrics.get("commit_hash"),
                commit_date=metrics.get("commit_date"),
                avg_function_length=metrics.get("avg_function_length", 0.0),
                cyclomatic_complexity=metrics.get("cyclomatic_complexity", 0.0),
                todo_count=metrics.get("todo_count", 0),
                undocumented_functions=metrics.get("undocumented_functions", 0),
                duplicate_blocks=metrics.get("duplicate_blocks", 0),
                recorded_at=_now(),
            )
            session.add(m)
            await session.commit()

    async def get_quality_metrics(
        self, repo_id: str, days_back: int = 30
    ) -> List[Dict[str, Any]]:
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=days_back)
        async with self.AsyncSessionLocal() as session:
            result = await session.execute(
                select(QualityMetric)
                .where(
                    QualityMetric.repo_id == repo_id,
                    QualityMetric.recorded_at >= cutoff,
                )
                .order_by(QualityMetric.commit_date.asc())
            )
            metrics = result.scalars().all()
            return [self._row_to_dict(m) for m in metrics]

    # ══════════════════════════════════════════════════════════════════════════
    # Security scan methods
    # ══════════════════════════════════════════════════════════════════════════

    async def save_security_scan(self, scan_data: Dict[str, Any]) -> None:
        async with self.AsyncSessionLocal() as session:
            scan = SecurityScan(
                id=_uuid(),
                repo_id=scan_data["repo_id"],
                findings=scan_data.get("findings", []),
                risk_score=scan_data.get("risk_score", 0),
                scanned_at=_now(),
            )
            session.add(scan)
            await session.commit()

    # ══════════════════════════════════════════════════════════════════════════
    # Repo pattern methods
    # ══════════════════════════════════════════════════════════════════════════

    async def save_repo_patterns(
        self, repo_id: str, patterns: List[Dict[str, Any]]
    ) -> None:
        async with self.AsyncSessionLocal() as session:
            # Clear existing patterns for this repo before reinserting
            existing = await session.execute(
                select(RepoPattern).where(RepoPattern.repo_id == repo_id)
            )
            for p in existing.scalars().all():
                await session.delete(p)
            for pattern in patterns:
                rp = RepoPattern(
                    id=_uuid(),
                    repo_id=repo_id,
                    pattern_type=pattern.get("pattern_type", "unknown"),
                    description=pattern.get("description", ""),
                    example_file=pattern.get("example_file"),
                )
                session.add(rp)
            await session.commit()

    async def get_repo_patterns(self, repo_id: str) -> List[Dict[str, Any]]:
        async with self.AsyncSessionLocal() as session:
            result = await session.execute(
                select(RepoPattern).where(RepoPattern.repo_id == repo_id)
            )
            patterns = result.scalars().all()
            return [self._row_to_dict(p) for p in patterns]


# ══════════════════════════════════════════════════════════════════════════════
# Singleton
# ══════════════════════════════════════════════════════════════════════════════

db = DatabaseClient()
