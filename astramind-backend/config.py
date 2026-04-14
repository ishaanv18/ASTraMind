"""
config.py — Astramind Application Configuration
Reads all settings from environment variables with sane defaults.
Switching between dev and prod is done entirely via AI_ENV and DB_ENV.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── AI Configuration ──────────────────────────────────────────────────────
    AI_ENV: str = Field(default="development", description="development | production")
    GROQ_API_KEY: str = Field(default="", description="Free key from console.groq.com")
    GROQ_MODEL: str = Field(default="llama-3.3-70b-versatile")
    GROQ_FALLBACK_MODEL: str = Field(default="llama-3.3-70b-versatile")
    OLLAMA_BASE_URL: str = Field(default="http://localhost:11434")
    OLLAMA_MODEL: str = Field(default="deepseek-coder:6.7b")

    # ── Database Configuration ────────────────────────────────────────────────
    DB_ENV: str = Field(default="development", description="development | production")
    DATABASE_URL: str = Field(default="sqlite+aiosqlite:///./astramind.db")
    SUPABASE_URL: str = Field(default="")
    SUPABASE_KEY: str = Field(default="")

    # ── Vector Store ──────────────────────────────────────────────────────────
    CHROMADB_PATH: str = Field(default="./chromadb_data")
    QDRANT_URL: str = Field(default="")
    QDRANT_API_KEY: str = Field(default="")

    # ── Cache / Queue ─────────────────────────────────────────────────────────
    REDIS_URL: str = Field(default="")

    # ── Application Settings ──────────────────────────────────────────────────
    REPOS_STORAGE_PATH: str = Field(default="./repos")
    MAX_FILE_SIZE_KB: int = Field(default=500)
    ALLOWED_ORIGINS: str = Field(default="http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173")
    PORT: int = Field(default=8000)
    APP_VERSION: str = Field(default="1.0.0")
    BREVO_API_KEY: str = Field(default="", description="Brevo (Sendinblue) API Key for sending emails")

    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def is_dev(self) -> bool:
        return self.AI_ENV.lower() == "development"

    @property
    def is_prod(self) -> bool:
        return self.AI_ENV.lower() == "production"

    @property
    def db_is_dev(self) -> bool:
        return self.DB_ENV.lower() == "development"

    @property
    def db_is_prod(self) -> bool:
        return self.DB_ENV.lower() == "production"


# Global singleton — import this everywhere
settings = Settings()

# Ensure required storage directories exist at import time
os.makedirs(settings.REPOS_STORAGE_PATH, exist_ok=True)
os.makedirs(settings.CHROMADB_PATH, exist_ok=True)
