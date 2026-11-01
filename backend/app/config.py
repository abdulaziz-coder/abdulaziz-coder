from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://bm:bm_local@127.0.0.1:5432/bm_school"
    temporal_address: str = "127.0.0.1:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "bm-admissions"
    admin_auth_path: Path = Path(__file__).resolve().parents[2] / ".local" / "admin-auth.json"
    admin_allowed_origins: list[str] = [f"http://{host}:{port}" for host in ["127.0.0.1", "localhost"] for port in [3000, 8000]]


settings = Settings()
