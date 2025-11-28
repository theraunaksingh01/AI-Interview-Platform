# api/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Callable, List
from sqlalchemy.orm import Session

from db.session import SessionLocal
from db import models as db_models
from core import security
from fastapi import HTTPException, Depends


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = security.decode_token(token)
    except Exception:
        raise credentials_exception

    sub = payload.get("sub")
    if sub is None:
        raise credentials_exception

    # Try numeric id first, fallback to email
    user = None
    try:
        user_id = int(sub)
        user = db.query(db_models.User).filter(db_models.User.id == user_id).first()
    except (TypeError, ValueError):
        user = db.query(db_models.User).filter(db_models.User.email == sub).first()

    if not user:
        raise credentials_exception
    return user


def require_roles(*allowed_roles: List[str]) -> Callable:
    def dependency(current_user=Depends(get_current_user)):
        user_role_titles = {r.title for r in current_user.roles}
        if not (user_role_titles & set(allowed_roles)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operation not permitted")
        return current_user
    return dependency

def require_admin(user = Depends(get_current_user)):
    # adapt to your user object (is_admin / roles etc)
    if not getattr(user, "is_admin", False) and not getattr(user, "is_hr", False):
        raise HTTPException(status_code=403, detail="admin access required")
    return user