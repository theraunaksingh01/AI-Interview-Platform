# api/auth.py
from datetime import timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from api import deps
from core import security
from core.config import settings
from db import models as db_models
from models.user import UserOut  
from datetime import timedelta


router = APIRouter(prefix="/auth", tags=["auth"])


# ---------- Schemas ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginJSON(BaseModel):
    email: EmailStr
    password: str


class TokenOut(Token):  
    pass



# ---------- Helpers ----------
def _issue_access_token(user: db_models.User) -> Token:
    access_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(subject=str(user.id), expires_delta=access_expires)
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=int(access_expires.total_seconds()),
    )


def _authenticate(db: Session, email: str, password: str) -> db_models.User:
    user = db.query(db_models.User).filter(db_models.User.email == email).first()
    if not user or not security.verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    if getattr(user, "is_active", True) is False:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return user


# ---------- Endpoints ----------
@router.post("/login", response_model=Token)
def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    OAuth2 Password flow for Swagger **Authorize** dialog.

    - username = email
    - password = user's password

    Returns: {access_token, token_type, expires_in}
    """
    # Swagger sends form_data.username; we treat it as email
    user = _authenticate(db, email=form_data.username, password=form_data.password)
    return _issue_access_token(user)


@router.post("/login_json", response_model=Token)
def login_json(payload: LoginJSON, db: Session = Depends(deps.get_db)) -> Any:
    """
    JSON login helper (useful with curl/Postman):
      POST /auth/login_json
      { "email": "...", "password": "..." }
    """
    user = _authenticate(db, email=payload.email, password=payload.password)
    return _issue_access_token(user)


@router.get("/me", response_model=UserOut)
def read_myself(current_user: db_models.User = Depends(deps.get_current_user)):
    """
    Returns the current authenticated user (UserOut).
    Ensures roles are serialized as strings.
    """
    roles: List[str] = [r.title for r in getattr(current_user, "roles", [])]
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": getattr(current_user, "full_name", None),
        "is_active": getattr(current_user, "is_active", True),
        "is_superuser": getattr(current_user, "is_superuser", False),
        "roles": roles,
    }


@router.get("/admin-only")
def admin_only(user: db_models.User = Depends(deps.require_roles("admin"))):
    return {"msg": f"Hello admin {user.email}"}


@router.post("/refresh", response_model=TokenOut)
def refresh_access(current_user: db_models.User = Depends(deps.get_current_user)):
    """
    Issues a fresh short-lived access token for the already-authenticated user.
    Client calls this when token is about to expire.
    """
    access_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access = security.create_access_token(
        subject=str(current_user.id), expires_delta=access_expires
    )
    return TokenOut(
        access_token=new_access,
        token_type="bearer",
        expires_in=int(access_expires.total_seconds()),
    )