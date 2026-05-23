from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

MINI_MODEL_ALLOWLIST = frozenset(
    {
        "gpt-4.1-mini",
        "gpt-4o-mini",
    }
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    sace_model: str = Field(default="gpt-4.1-mini", alias="SACE_MODEL")
    sace_max_depth: int = Field(default=5, alias="SACE_MAX_DEPTH")
    sace_log_level: str = Field(default="INFO", alias="SACE_LOG_LEVEL")
    data_trees_dir: str = Field(default="data/trees", alias="SACE_DATA_TREES_DIR")
    database_url: str = Field(default="sqlite:///./data/sace.db", alias="SACE_DATABASE_URL")

    def validate_model(self) -> None:
        if self.sace_model not in MINI_MODEL_ALLOWLIST:
            raise ValueError(
                f"SACE_MODEL must be a mini-tier model; got {self.sace_model!r}. "
                f"Allowed: {sorted(MINI_MODEL_ALLOWLIST)}"
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
