# backend/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional, List
import json
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # ignore unknown keys instead of crashing
    )

    # ---- Auth / JWT (both canonical & legacy/uppercase available via properties)
    # canonical
    secret_key: str = Field("dev-secret-change-me", alias="JWT_SECRET")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(15, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(7, alias="REFRESH_TOKEN_EXPIRE_DAYS")

    # keep explicit uppercase too (so pydantic also reads them directly if present)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-me")

    # ---- DB (accept either)
    database_url: Optional[str] = Field(default=None, alias="DATABASE_URL")
    db_url_compat: Optional[str] = Field(default=None, alias="DB_URL")

    # ---- S3 / MinIO (canonical)
    s3_endpoint: str = Field("http://127.0.0.1:9000", alias="S3_ENDPOINT")
    s3_region: str = Field("us-east-1", alias="S3_REGION")
    s3_access_key: str = Field("minioadmin", alias="S3_ACCESS_KEY")
    s3_secret_key: str = Field("minioadmin", alias="S3_SECRET_KEY")
    s3_bucket: str = Field("ai-interview-uploads", alias="S3_BUCKET")
    s3_use_ssl: bool = Field(False, alias="S3_USE_SSL")
    presigned_url_expires: int = Field(900, alias="PRESIGNED_URL_EXPIRES")

    # ---- CORS raw (we’ll parse)
    cors_origins_raw: str = Field(
        "http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ORIGINS",
    )

    # ---- Redis / Celery (optional)
    redis_url: Optional[str] = Field("redis://127.0.0.1:6379/0", alias="REDIS_URL")
    celery_broker_url: Optional[str] = Field("redis://127.0.0.1:6379/0", alias="CELERY_BROKER_URL")
    celery_result_backend: Optional[str] = Field("redis://127.0.0.1:6379/0", alias="CELERY_RESULT_BACKEND")

    # ---- Helpers / parsed properties
    @property
    def cors_origins(self) -> List[str]:
        s = (self.cors_origins_raw or "").strip()
        if not s:
            return ["http://localhost:3000", "http://127.0.0.1:3000"]
        if s.startswith("["):
            try:
                arr = json.loads(s)
                if isinstance(arr, list):
                    return [str(x).strip() for x in arr if str(x).strip()]
            except Exception:
                pass
        return [x.strip() for x in s.split(",") if x.strip()]

    @property
    def database_url_effective(self) -> Optional[str]:
        return self.database_url or self.db_url_compat

    # ---- Back-compat uppercase properties (used elsewhere in your code)
    @property
    def DATABASE_URL(self) -> Optional[str]:
        return self.database_url_effective

    @property
    def SECRET_KEY(self) -> str:
        # some code uses SECRET_KEY instead of JWT_SECRET / secret_key
        return self.secret_key or self.JWT_SECRET

    @property
    def S3_ENDPOINT(self) -> str:
        return self.s3_endpoint

    @property
    def S3_REGION(self) -> str:
        return self.s3_region

    @property
    def S3_ACCESS_KEY(self) -> str:
        return self.s3_access_key

    @property
    def S3_SECRET_KEY(self) -> str:
        return self.s3_secret_key

    @property
    def S3_BUCKET(self) -> str:
        return self.s3_bucket

    @property
    def S3_USE_SSL(self) -> bool:
        return bool(self.s3_use_ssl)

    @property
    def PRESIGNED_URL_EXPIRES(self) -> int:
        return int(self.presigned_url_expires)


settings = Settings()
