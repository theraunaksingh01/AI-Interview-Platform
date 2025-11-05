# backend/core/security.py
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt
from passlib.context import CryptContext

from core.config import settings

JWT_SECRET = getattr(settings, "SECRET_KEY", getattr(settings, "JWT_SECRET", "change-me"))
JWT_ALGORITHM = getattr(settings, "JWT_ALGORITHM", "HS256")

# ---- TEST MODE (plaintext passwords) ----
# If set, we avoid crypto backends entirely in tests to keep them deterministic.
TEST_PLAINTEXT = os.getenv("TEST_PLAINTEXT_PASSWORDS", "0") == "1"

if TEST_PLAINTEXT:
    # Dummy “hash”: prefix so we still store something that looks hashed
    def get_password_hash(password: str) -> str:
        return f"plain::{password}"

    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return hashed_password == f"plain::{plain_password}"
else:
    # Production/dev: PBKDF2-SHA256
    pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    def verify_password(plain_password: str, hashed_password: str) -> bool:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False


# Token expiry (minutes) default from settings, with safe fallback
ACCESS_EXPIRE_MINUTES = int(getattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 15))


def create_access_token(
    subject: str,
    expires_minutes: Optional[int] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a JWT. Supports both 'expires_minutes' and 'expires_delta' for compatibility.
    """
    if expires_delta is not None:
        exp = datetime.now(timezone.utc) + expires_delta
    else:
        exp = datetime.now(timezone.utc) + timedelta(
            minutes=expires_minutes or ACCESS_EXPIRE_MINUTES
        )

    to_encode = {"sub": str(subject), "exp": exp}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
