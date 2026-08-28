# api/auth.py
from datetime import timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.orm import Session

from api import deps
from api.rate_limit import login_rate_limit_dep
from core import security
from core.config import settings
from db import models as db_models
from models.user import UserOut  
from core.rate_limit import limiter
from fastapi import BackgroundTasks
import logging
log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------- Schemas ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginJSON(BaseModel):
    email: EmailStr
    password: str


class RegisterPayload(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class OnboardingPayload(BaseModel):
    college: Optional[str] = None
    year_of_study: Optional[str] = None
    branch: Optional[str] = None
    placement_goal: Optional[str] = None
    target_roles: Optional[list] = None
    target_companies: Optional[list] = None
    self_level: Optional[str] = None


class UpdateMePayload(BaseModel):
    full_name: Optional[str] = None
    college: Optional[str] = None
    year_of_study: Optional[str] = None
    branch: Optional[str] = None
    target_companies: Optional[list[str]] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class TokenOut(Token):  
    pass


# CONSENT ENDPOINT
class ConsentPayload(BaseModel):
    consent: bool


@router.post("/me/consent")
def record_consent(
    payload: ConsentPayload,
    db: Session = Depends(deps.get_db),
    current_user: db_models.User = Depends(deps.get_current_user),
):
    """
    Record the user's consent for voice/audio processing during mock interviews.
    Called once before their first mic access — persisted so they aren't asked again.
    """
    db.execute(
        text("""
            UPDATE users
            SET consent_audio_processing = :consent,
                consent_date = CASE WHEN :consent THEN NOW() ELSE consent_date END
            WHERE id = :uid
        """),
        {"consent": payload.consent, "uid": current_user.id},
    )
    db.commit()
    return {"ok": True, "consent": payload.consent}


@router.get("/me/consent")
def get_consent(
    db: Session = Depends(deps.get_db),
    current_user: db_models.User = Depends(deps.get_current_user),
):
    """Check if the user has already given consent — used to skip the modal on repeat visits."""
    row = db.execute(
        text("SELECT consent_audio_processing FROM users WHERE id = :uid"),
        {"uid": current_user.id},
    ).first()
    return {"consent": bool(row[0]) if row else False}


class DeleteAccountPayload(BaseModel):
    confirm_email: str  # student must type their email to confirm
 
 
@router.delete("/me")
def delete_account(
    payload: DeleteAccountPayload,
    db: Session = Depends(deps.get_db),
    current_user: db_models.User = Depends(deps.get_current_user),
):
    """
    Permanently delete the current user's account and all associated data.
    Requires typing the exact email as confirmation.
 
    Deletion order matters — tables without ON DELETE CASCADE on user_id
    must be cleaned up manually before the user row itself is deleted.
    """
    if payload.confirm_email.strip().lower() != current_user.email.strip().lower():
        raise HTTPException(
            status_code=400,
            detail="Email confirmation does not match. Account not deleted.",
        )
 
    user_id = current_user.id
    user_email = current_user.email
 
    try:
        # ── Step 1: Delete mock_sessions explicitly (no auto-cascade from users) ──
        # This will cascade further into: communication_reports, multi_agent_sessions,
        # session_feedback (all ON DELETE CASCADE from mock_sessions)
        # candidate_question_history and interviews.mock_session_id will SET NULL automatically
        db.execute(
            text("DELETE FROM mock_sessions WHERE user_id = :uid"),
            {"uid": user_id},
        )
 
        # ── Step 2: Delete referral_events where this user is involved ──
        # (referred_id has UNIQUE + CASCADE per our earlier migration, but referrer_id
        #  rows where THIS user was the referrer also need cleanup)
        db.execute(
            text("DELETE FROM referral_events WHERE referrer_id = :uid OR referred_id = :uid"),
            {"uid": user_id},
        )
 
        # ── Step 3: Delete topic_practice_sessions and results ──
        db.execute(
            text("""
                DELETE FROM topic_practice_results
                WHERE session_id IN (
                    SELECT id FROM topic_practice_sessions WHERE user_id = :uid
                )
            """),
            {"uid": user_id},
        )
        db.execute(
            text("DELETE FROM topic_practice_sessions WHERE user_id = :uid"),
            {"uid": user_id},
        )
 
        # ── Step 4: Delete quick_prep sessions and results ──
        db.execute(
            text("""
                DELETE FROM quick_prep_concept_results
                WHERE session_id IN (
                    SELECT id FROM quick_prep_sessions WHERE user_id = :uid
                )
            """),
            {"uid": user_id},
        )
        db.execute(
            text("DELETE FROM quick_prep_sessions WHERE user_id = :uid"),
            {"uid": user_id},
        )
 
        # ── Step 5: Delete resume_prep_sessions ──
        db.execute(
            text("DELETE FROM resume_prep_sessions WHERE user_id = :uid"),
            {"uid": user_id},
        )
 
        # ── Step 6: Delete DSA attempts ──
        db.execute(
            text("DELETE FROM dsa_attempts WHERE user_id = :uid"),
            {"uid": user_id},
        )
 
        # ── Step 7: Delete OA attempts (has SET NULL, but let's fully remove for privacy) ──
        db.execute(
            text("DELETE FROM oa_attempts WHERE user_id = :uid"),
            {"uid": user_id},
        )
 
        # ── Step 8: Delete assessment attempts (has SET NULL, fully remove for privacy) ──
        db.execute(
            text("DELETE FROM assessment_attempts WHERE user_id = :uid"),
            {"uid": user_id},
        )
 
        # ── Step 9: Delete peer practice data ──
        db.execute(
            text("DELETE FROM peer_attempts WHERE user_id = :uid"),
            {"uid": user_id},
        )
        db.execute(
            text("DELETE FROM peer_stats WHERE user_id = :uid"),
            {"uid": user_id},
        )
        # Peer rooms created by this user — set creator to null or delete if no other participant
        db.execute(
            text("DELETE FROM peer_rooms WHERE created_by = :uid"),
            {"uid": user_id},
        )
 
        # ── Step 10: Delete daily answers, submitted questions ──
        # (both have ON DELETE CASCADE already, but explicit delete is fine too — safe no-op if already gone)
 
        # ── Step 11: Delete uploads (files should also be cleaned from local storage) ──
        upload_keys = db.execute(
            text("SELECT key FROM uploads WHERE user_id = :uid"),
            {"uid": user_id},
        ).fetchall()
        # Note: actual file deletion from disk/S3 should happen here if uploads are stored.
        # Since we confirmed resume-prep and mock interview don't use S3, this is likely a no-op,
        # but any orphaned files in /agent_audio or local upload dirs tied to this user's
        # sessions should be cleaned by a periodic job, not inline here (keep deletion fast).
 
        # ── Step 12: Finally, delete the user row itself ──
        # This will CASCADE into: interview_calendar, interviews, daily_answers,
        # submitted_questions, uploads, user_notifications, user_roles
        db.execute(
            text("DELETE FROM users WHERE id = :uid"),
            {"uid": user_id},
        )
 
        db.commit()
        log.info(f"[account_deletion] User {user_id} ({user_email}) account deleted successfully")
 
    except Exception as e:
        db.rollback()
        log.exception(f"[account_deletion] Failed to delete user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Account deletion failed. Please contact support — your account has not been altered.",
        )
 
    return {
        "ok": True,
        "message": "Your account and all associated data have been permanently deleted.",
    }
    

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
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(deps.get_db),
    _rl=Depends(login_rate_limit_dep),
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


@router.post("/register", response_model=Token)

def register(request: Request, payload: RegisterPayload, db: Session = Depends(deps.get_db), _rl=Depends(login_rate_limit_dep)) -> Any:
    """
    Create a new user account and return an access token.
    """
    # Check if email already exists
    existing = db.query(db_models.User).filter(
        db_models.User.email == payload.email
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )
    # Create user
    hashed = security.get_password_hash(payload.password)

    # Generate a unique referral code (required NOT NULL column)
    import hashlib
    from datetime import datetime as dt
    referral_code = hashlib.md5(f"{payload.email}{dt.utcnow()}".encode()).hexdigest()[:8].upper()
    while db.query(db_models.User).filter(db_models.User.referral_code == referral_code).first():
        referral_code = hashlib.md5(f"{payload.email}{dt.utcnow()}{referral_code}".encode()).hexdigest()[:8].upper()

    user = db_models.User(
        email=payload.email,
        hashed_password=hashed,
        full_name=payload.full_name,
        is_active=True,
        is_superuser=False,
        plan="free",
        referral_code=referral_code,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_access_token(user)


@router.post("/onboarding")
def save_onboarding(
    payload: OnboardingPayload,
    current_user: db_models.User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Save onboarding profile for a newly registered user.
    Sets onboarding_done = True on completion.
    """
    import json

    updates = {}
    if payload.college is not None:
        updates["college"] = payload.college[:200]
    if payload.year_of_study is not None:
        updates["year_of_study"] = payload.year_of_study
    if payload.branch is not None:
        updates["branch"] = payload.branch
    if payload.placement_goal is not None:
        updates["placement_goal"] = payload.placement_goal
    if payload.target_roles is not None:
        updates["target_roles"] = json.dumps(payload.target_roles)
    if payload.target_companies is not None:              
        updates["target_companies"] = payload.target_companies
    if payload.self_level is not None:
        updates["self_level"] = payload.self_level

    updates["onboarding_done"] = True

    if updates:
        set_clause = ", ".join(f"{k} = :{k}" for k in updates)
        updates["uid"] = current_user.id
        db.execute(
            text(f"UPDATE users SET {set_clause} WHERE id = :uid"),
            updates,
        )
        db.commit()

    return {"ok": True, "onboarding_done": True}


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
        "college": getattr(current_user, "college", None),
        "year_of_study": getattr(current_user, "year_of_study", None),
        "branch": getattr(current_user, "branch", None),
        "is_active": getattr(current_user, "is_active", True),
        "is_superuser": getattr(current_user, "is_superuser", False),
        "roles": roles,
        "plan": getattr(current_user, "plan", "free") or "free",
        "onboarding_done": getattr(current_user, "onboarding_done", False) or False,
        "target_roles": getattr(current_user, "target_roles", []) or [],
        "self_level": getattr(current_user, "self_level", None),
        "placement_goal": getattr(current_user, "placement_goal", None),
        "target_companies": getattr(current_user, "target_companies", []) or [],
        "linkedin_url": getattr(current_user, "linkedin_url", None),
        "github_url": getattr(current_user, "github_url", None),
    }


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UpdateMePayload,
    db: Session = Depends(deps.get_db),
    current_user: db_models.User = Depends(deps.get_current_user),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.college is not None:
        current_user.college = payload.college
    if payload.year_of_study is not None:
        current_user.year_of_study = payload.year_of_study
    if payload.branch is not None:
        current_user.branch = payload.branch
    if payload.target_companies is not None:
        current_user.target_companies = payload.target_companies
    if payload.linkedin_url is not None:
        current_user.linkedin_url = payload.linkedin_url
    if payload.github_url is not None:
        current_user.github_url = payload.github_url
    if payload.new_password:
        if not payload.current_password or not security.verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password incorrect")
        current_user.hashed_password = security.get_password_hash(payload.new_password)
    db.commit()
    db.refresh(current_user)
    roles: List[str] = [r.title for r in getattr(current_user, "roles", [])]
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": getattr(current_user, "full_name", None),
        "college": getattr(current_user, "college", None),
        "year_of_study": getattr(current_user, "year_of_study", None),
        "branch": getattr(current_user, "branch", None),
        "is_active": getattr(current_user, "is_active", True),
        "is_superuser": getattr(current_user, "is_superuser", False),
        "roles": roles,
        "plan": getattr(current_user, "plan", "free") or "free",
        "onboarding_done": getattr(current_user, "onboarding_done", False) or False,
        "target_roles": getattr(current_user, "target_roles", []) or [],
        "self_level": getattr(current_user, "self_level", None),
        "placement_goal": getattr(current_user, "placement_goal", None),
        "target_companies": getattr(current_user, "target_companies", []) or [],
        "linkedin_url": getattr(current_user, "linkedin_url", None),
        "github_url": getattr(current_user, "github_url", None),
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