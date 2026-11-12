from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    api_title: str = "workflow-capture-ai API"
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    database_url: str = Field(
        default="postgresql+psycopg://workflow_capture_ai:workflow_capture_ai@localhost:5432/workflow_capture_ai",
        alias="DATABASE_URL",
    )
    storage_root: str = Field(default="./data", alias="STORAGE_ROOT")
    cors_origins: str = Field(default="http://localhost:3000,http://127.0.0.1:3000", alias="CORS_ORIGINS")

    @property
    def repo_root(self) -> Path:
        return Path(__file__).resolve().parents[3]

    @property
    def storage_root_path(self) -> Path:
        raw_path = Path(self.storage_root)
        if raw_path.is_absolute():
            return raw_path
        return (self.repo_root / raw_path).resolve()

    @property
    def screenshots_dir(self) -> Path:
        return self.storage_root_path / "screenshots"

    @property
    def exports_dir(self) -> Path:
        return self.storage_root_path / "exports"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
