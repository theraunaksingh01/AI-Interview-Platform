# backend/tests/conftest.py
import os
import sys
import types
import io
import pathlib
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# -------------------------------------------------------------------------------------------------
# Path & environment setup (must happen BEFORE importing your app)
# -------------------------------------------------------------------------------------------------

# Ensure project root (backend/) is importable
ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Temp SQLite DB file for tests
TEST_DB_FILE = str(pathlib.Path(tempfile.gettempdir()) / "ai_interview_test.sqlite")

# Point the app to the test DB and set safe/dev-ish defaults
os.environ.setdefault("APP_SAFE", "0")  # enable dev routers if you gate them
os.environ.setdefault("DATABASE_URL", f"sqlite:///{TEST_DB_FILE}")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("S3_BUCKET", "test-bucket")
os.environ.setdefault("S3_REGION", "us-east-1")
os.environ.setdefault("S3_ENDPOINT", "http://127.0.0.1:9000")
os.environ.setdefault("PRESIGNED_URL_EXPIRES", "900")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("JWT_SECRET", "test-secret")
# Celery/Redis (won't be used thanks to the stub, but set anyway)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("CELERY_RESULT_BACKEND", os.environ["REDIS_URL"])
os.environ.setdefault("TEST_PLAINTEXT_PASSWORDS", "1")


# -------------------------------------------------------------------------------------------------
# Import app & modules AFTER env vars
# -------------------------------------------------------------------------------------------------
from main import app
from api import deps
from db import models as m
from core import security

# -------------------------------------------------------------------------------------------------
# Test DB engine + session factory
# -------------------------------------------------------------------------------------------------
engine = create_engine(f"sqlite:///{TEST_DB_FILE}", future=True)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

# Fresh schema each test session
@pytest.fixture(scope="function", autouse=True)
def reset_db():
    """Drop + recreate DB before each test function to ensure isolation"""
    m.Base.metadata.drop_all(bind=engine)
    m.Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture(scope="function")
def db():
    """Yield a fresh DB session per test function."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()

def _override_get_db():
    session = TestingSessionLocal()
    try:
        yield session
        session.commit()
    finally:
        session.close()

# Override the app's DB dependency
app.dependency_overrides[deps.get_db] = _override_get_db

# -------------------------------------------------------------------------------------------------
# ---- Fake S3 client (no network) ----
class _FakeS3:
    def __init__(self):
        self._store = {}
        self._buckets = set()

    def create_bucket(self, Bucket, **kwargs):
        self._buckets.add(Bucket)

    def put_object(self, Bucket, Key, Body, **kwargs):
        self._buckets.add(Bucket)
        self._store[(Bucket, Key)] = (
            Body if isinstance(Body, (bytes, bytearray)) else Body.read()
        )

    def upload_fileobj(self, Fileobj, Bucket, Key, ExtraArgs=None):
        self._buckets.add(Bucket)
        self._store[(Bucket, Key)] = Fileobj.read()

    def delete_object(self, Bucket, Key):
        self._store.pop((Bucket, Key), None)


@pytest.fixture(scope="session", autouse=True)
def patch_s3():
    """
    Ensure every code path uses the fake S3 client, even modules that did
    `from core.s3_client import get_s3_client` before this fixture ran.
    """
    import core.s3_client as s3mod
    import api.uploads as uploads_mod

    fake = _FakeS3()

    def _fake_get_s3_client():
        return fake

    # 1) Replace the function on the module (for late imports)
    try:
        s3mod.get_s3_client.cache_clear()  # if @lru_cache is present
    except Exception:
        pass
    s3mod.get_s3_client = _fake_get_s3_client

    # 2) Replace the already-imported symbol inside api.uploads
    uploads_mod.get_s3_client = _fake_get_s3_client

    # (If you call S3 from other modules, patch them here too.)

    yield



# -------------------------------------------------------------------------------------------------
# Stub Celery task (no worker needed)
# -------------------------------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def patch_celery_delay():
    # Replace transcribe_upload.delay with a stub that returns an object with id
    from tasks import transcribe as tmod

    def _fake_delay(upload_id: int):
        # Could also update DB here to 'processing'/'done' for end-to-end checks.
        return types.SimpleNamespace(id=f"fake-{upload_id}")

    tmod.transcribe_upload.delay = _fake_delay  # type: ignore[attr-defined]
    yield

# -------------------------------------------------------------------------------------------------
# TestClient
# -------------------------------------------------------------------------------------------------
@pytest.fixture(scope="session")
def client():
    return TestClient(app)

# -------------------------------------------------------------------------------------------------
# Helper: create a user and get JWT
# -------------------------------------------------------------------------------------------------
@pytest.fixture(scope="function")
def user_and_token(db):
    """
    Create a user, return (user, token), and override auth dependency so routes
    see this user as authenticated without actually verifying the JWT.
    This keeps tests deterministic and avoids secret/decoder drift.
    """
    email = "admin@example.com"
    pwd = "admin123"

    # create user directly
    u = m.User(
        email=email,
        hashed_password=security.get_password_hash(pwd),
        is_active=True,
        is_superuser=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)

    # still exercise /auth/login_json to keep the flow realistic
    c = TestClient(app)
    r = c.post("/auth/login_json", json={"email": email, "password": pwd})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]

    # --- dependency override: always return this user (skip JWT validation) ---
    orig = app.dependency_overrides.get(deps.get_current_user)

    def _override_current_user():
        return u

    app.dependency_overrides[deps.get_current_user] = _override_current_user

    try:
        yield (u, token)
    finally:
        # restore previous override after each test
        if orig is None:
            app.dependency_overrides.pop(deps.get_current_user, None)
        else:
            app.dependency_overrides[deps.get_current_user] = orig
