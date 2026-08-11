# backend/api/referral.py
# Referral system — generate codes, claim referrals, track rewards

import random
import string
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from api.deps import get_current_user
from db.session import get_db
from db import models as db_models
import os

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

router = APIRouter(prefix="/api/referral", tags=["referral"])

# ── Config ────────────────────────────────────────────────────────────────────

REFERRAL_CODE_LENGTH = 8

# Rewards
REFERRER_BONUS_SESSIONS = 3   # referrer gets 3 bonus sessions per successful referral
REFERRED_BONUS_SESSIONS = 2   # new user gets 2 bonus sessions when they sign up via referral

# Max referrals that give rewards (prevent abuse)
MAX_REWARDED_REFERRALS = 20

# ── Helpers ───────────────────────────────────────────────────────────────────

def generate_referral_code(db: Session, user_id: int, email: str) -> str:
    """Generate a unique 8-character referral code."""
    import hashlib
    base = hashlib.md5(f"{user_id}{email}".encode()).hexdigest()[:6].upper()
    code = base
    # Ensure uniqueness
    attempts = 0
    while db.execute(
        text("SELECT id FROM users WHERE referral_code = :code AND id != :uid"),
        {"code": code, "uid": user_id}
    ).first():
        suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=2))
        code = base[:6] + suffix
        attempts += 1
        if attempts > 10:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            break
    return code


def ensure_referral_code(db: Session, user: db_models.User) -> str:
    """Get or create referral code for user."""
    existing = db.execute(
        text("SELECT referral_code FROM users WHERE id = :uid"),
        {"uid": user.id}
    ).scalar()
    
    if existing:
        return existing
    
    code = generate_referral_code(db, user.id, user.email)
    db.execute(
        text("UPDATE users SET referral_code = :code WHERE id = :uid"),
        {"code": code, "uid": user.id}
    )
    db.commit()
    return code


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/my")
def get_my_referral(
    current_user: db_models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's referral code, stats, and referral link."""
    code = ensure_referral_code(db, current_user)
    
    # Get referral stats
    stats = db.execute(
        text("""
            SELECT
                COUNT(*) as total_referrals,
                COUNT(*) FILTER (WHERE reward_given = TRUE) as rewarded_referrals
            FROM referral_events
            WHERE referrer_id = :uid
        """),
        {"uid": current_user.id}
    ).mappings().first()

    # Get referred users list (last 10)
    referred = db.execute(
        text("""
            SELECT u.full_name, u.email, re.created_at, re.reward_given
            FROM referral_events re
            JOIN users u ON u.id = re.referred_id
            WHERE re.referrer_id = :uid
            ORDER BY re.created_at DESC
            LIMIT 10
        """),
        {"uid": current_user.id}
    ).mappings().all()

    # Get current bonus sessions
    bonus = db.execute(
        text("SELECT session_credits FROM users WHERE id = :uid"),    
        {"uid": current_user.id}
    ).scalar() or 0

    credits = db.execute(
        text("SELECT credits FROM users WHERE id = :uid"),
        {"uid": current_user.id}
    ).scalar() or 0

    return {
        "referral_code": code,
        "referral_link": f"{FRONTEND_URL}/signup?ref={code}",      
        "total_referrals": stats["total_referrals"] if stats else 0,
        "rewarded_referrals": stats["rewarded_referrals"] if stats else 0,
        "bonus_sessions_earned": (stats["rewarded_referrals"] if stats else 0) * REFERRER_BONUS_SESSIONS,
        "session_credits": bonus,
        "credits": credits,
        "referred_users": [
            {
                "name": r["full_name"] or r["email"].split("@")[0],
                "joined": r["created_at"].isoformat() if r["created_at"] else None,
                "reward_given": r["reward_given"],
            }
            for r in referred
        ],
        "rewards": {
            "referrer_gets": f"{REFERRER_BONUS_SESSIONS} bonus sessions per referral",
            "referred_gets": f"{REFERRED_BONUS_SESSIONS} bonus sessions on signup",
            "max_rewarded": MAX_REWARDED_REFERRALS,
        }
    }


@router.post("/claim")
def claim_referral(
    payload: dict,
    current_user: db_models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Claim a referral code after signup.
    Called when new user enters referral code on signup or profile.
    """
    ref_code = (payload.get("referral_code") or "").strip().upper()
    if not ref_code:
        raise HTTPException(status_code=400, detail="Referral code is required")

    # Check if user already used a referral
    already_referred = db.execute(
        text("SELECT id FROM referral_events WHERE referred_id = :uid"),
        {"uid": current_user.id}
    ).first()
    if already_referred:
        raise HTTPException(status_code=400, detail="You have already used a referral code")

    # Find referrer
    referrer = db.execute(
        text("SELECT id, full_name FROM users WHERE referral_code = :code AND id != :uid"),
        {"code": ref_code, "uid": current_user.id}
    ).mappings().first()
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    # Check referrer hasn't hit max rewarded referrals
    referrer_count = db.execute(
        text("SELECT COUNT(*) FROM referral_events WHERE referrer_id = :uid AND reward_given = TRUE"),
        {"uid": referrer["id"]}
    ).scalar() or 0

    give_reward = referrer_count < MAX_REWARDED_REFERRALS

    # Log referral event
    db.execute(
        text("""
            INSERT INTO referral_events
                (referrer_id, referred_id, reward_given, reward_type, reward_value)
            VALUES
                (:referrer_id, :referred_id, :reward_given, :reward_type, :reward_value)
        """),
        {
            "referrer_id": referrer["id"],
            "referred_id": current_user.id,
            "reward_given": give_reward,
            "reward_type": "bonus_session",
            "reward_value": REFERRER_BONUS_SESSIONS if give_reward else 0,
        }
    )

    # Give bonus sessions to referrer
    if give_reward:
        db.execute(
            text("""
                UPDATE users
                SET session_credits = COALESCE(session_credits, 0) + :bonus,
                    referral_count = COALESCE(referral_count, 0) + 1
                WHERE id = :uid
            """),
            {"bonus": REFERRER_BONUS_SESSIONS, "uid": referrer["id"]}
        )

    # Give bonus sessions to new user (referred)
    db.execute(
        text("""
            UPDATE users
            SET session_credits = COALESCE(session_credits, 0) + :bonus,
                referred_by = :referrer_id
            WHERE id = :uid
        """),
        {
            "bonus": REFERRED_BONUS_SESSIONS,
            "referrer_id": referrer["id"],
            "uid": current_user.id,
        }
    )

    db.commit()

    return {
        "success": True,
        "message": f"Referral applied! You got {REFERRED_BONUS_SESSIONS} bonus sessions.",
        "bonus_sessions_added": REFERRED_BONUS_SESSIONS,
        "referred_by": referrer["full_name"] or "a friend",
    }


@router.get("/validate/{code}")
def validate_referral_code(
    code: str,
    db: Session = Depends(get_db),
):
    """
    Public endpoint — validate a referral code before signup.
    Used on the signup page to show who referred them.
    """
    referrer = db.execute(
        text("SELECT full_name FROM users WHERE referral_code = :code"),
        {"code": code.strip().upper()}
    ).mappings().first()

    if not referrer:
        return {"valid": False}

    name = referrer["full_name"] or "A Qued student"
    first_name = name.split()[0] if name else "Someone"

    return {
        "valid": True,
        "referred_by_name": first_name,
        "message": f"{first_name} invited you to Qued — you'll get {REFERRED_BONUS_SESSIONS} bonus sessions when you sign up.",
    }