# api/auth.py
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Any, List

from db.session import SessionLocal
from db import models as db_models
from core import security
from core.config import settings
from api import deps
from models.user import UserOut, UserCreate  # you already have these; we'll use UserOut for response

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(deps.get_db)) -> Any:
    """
    Accepts form-data: username=<email>, password=<password>
    Returns: {"access_token","token_type","expires_in"}
    """
    user = db.query(db_models.User).filter(db_models.User.email == form_data.username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect email or password")

    if not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect email or password")

    access_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(subject=str(user.id), expires_delta=access_expires)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": int(access_expires.total_seconds()),
    }


@router.get("/me", response_model=UserOut)
def read_myself(current_user: db_models.User = Depends(deps.get_current_user)):
    """
    Returns current authenticated user.
    UserOut must be compatible with ORM user attributes:
      id, email, full_name, is_active, is_superuser, roles (list[str])
    """
    roles: List[str] = [r.title for r in current_user.roles]
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
