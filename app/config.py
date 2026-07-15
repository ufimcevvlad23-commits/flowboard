from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def normalize_database_url(url: str) -> str:
    """Use the installed psycopg v3 driver for generic Postgres URLs."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


@dataclass(frozen=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///./seo_mvp.db"))
    llm_api_key: str | None = os.getenv("LLM_API_KEY")
    llm_base_url: str = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    llm_model: str = os.getenv("LLM_MODEL", "gpt-4.1-mini")
    keys_so_api_key: str | None = os.getenv("KEYS_SO_API_KEY")
    arsenkin_api_key: str | None = os.getenv("ARSENKIN_API_KEY")
    external_api_timeout: float = float(os.getenv("EXTERNAL_API_TIMEOUT", "20"))
    keys_so_database: str = os.getenv("KEYS_SO_DATABASE", "msk")

    @property
    def llm_enabled(self) -> bool:
        return bool(self.llm_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
