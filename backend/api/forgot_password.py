# backend/api/forgot_password.py
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.session import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Config ────────────────────────────────────────────────────────────────────
# Replace with your Resend API key and from address
# When you get your domain, change RESEND_FROM to noreply@qued.in
import os
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM    = os.environ.get("RESEND_FROM", "onboarding@resend.dev")
APP_URL        = os.environ.get("APP_URL", "http://localhost:3000")

# ── Schemas ───────────────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# ── Email helper ──────────────────────────────────────────────────────────────

def send_reset_email(to_email: str, reset_url: str, full_name: str | None) -> bool:
    """Send password reset email via Resend. Returns True on success."""
    if not RESEND_API_KEY:
        # Dev mode — print to console instead
        print(f"\n[DEV] Password reset link for {to_email}:\n{reset_url}\n")
        return True

    import httpx

    name = full_name or "there"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 18px; font-weight: 900; color: #111;">
          Qu<span style="background: #FFD600; padding: 1px 4px; border-radius: 3px;">ed</span>
        </span>
      </div>
      <h2 style="font-size: 22px; font-weight: 900; color: #111; margin-bottom: 8px;">
        Reset your password
      </h2>
      <p style="color: #6B7280; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
        Hi {name}, we received a request to reset your Qued password.
        Click the button below to set a new password. This link expires in 30 minutes.
      </p>
      <a href="{reset_url}"
         style="display: inline-block; background: #111; color: white; font-weight: 700;
                font-size: 14px; padding: 12px 28px; border-radius: 10px;
                text-decoration: none; margin-bottom: 24px;">
        Reset password →
      </a>
      <p style="color: #9CA3AF; font-size: 13px; line-height: 1.6;">
        If you didn't request this, you can safely ignore this email.
        Your password won't change until you click the link above.
      </p>
      <hr style="border: none; border-top: 1px solid #F3F4F6; margin: 24px 0;">
      <p style="color: #9CA3AF; font-size: 12px;">
        Qued · AI-powered placement interview practice
      </p>
    </div>
    """

    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": RESEND_FROM,
                "to":   [to_email],
                "subject": "Reset your Qued password",
                "html": html,
            },
            timeout=10,
        )
        return resp.status_code == 200
    except Exception as e:
        print(f"[EMAIL] Failed to send reset email: {e}")
        return False

# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Request a password reset email.
    Always returns 200 regardless of whether email exists — prevents user enumeration.
    """
    user = db.execute(
        text("SELECT id, email, full_name FROM users WHERE email = :email AND is_active = TRUE"),
        {"email": payload.email.lower().strip()},
    ).mappings().first()

    if user:
        # Generate secure token
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(minutes=30)

        db.execute(
            text("""
                UPDATE users
                SET reset_token = :token, reset_token_expires = :expires
                WHERE id = :uid
            """),
            {"token": token, "expires": expires, "uid": user["id"]},
        )
        db.commit()

        reset_url = f"{APP_URL}/reset-password?token={token}"
        send_reset_email(
            to_email=user["email"],
            reset_url=reset_url,
            full_name=user["full_name"],
        )

    # Always return same response — never reveal if email exists
    return {
        "message": "If an account with that email exists, you'll receive a reset link shortly."
    }


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """Reset password using the token from email."""
    if len(payload.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    user = db.execute(
        text("""
            SELECT id, reset_token_expires
            FROM users
            WHERE reset_token = :token AND is_active = TRUE
        """),
        {"token": payload.token},
    ).mappings().first()

    if not user:
        raise HTTPException(400, "Invalid or expired reset link")

    # Check expiry
    expires = user["reset_token_expires"]
    if expires is None or datetime.now(timezone.utc) > expires:
        raise HTTPException(400, "Reset link has expired. Please request a new one.")

    # Hash new password using project's existing security module
    from core import security
    hashed = security.get_password_hash(payload.new_password)

    # Update password and clear token
    db.execute(
        text("""
            UPDATE users
            SET hashed_password = :hashed,
                reset_token = NULL,
                reset_token_expires = NULL
            WHERE id = :uid
        """),
        {"hashed": hashed, "uid": user["id"]},
    )
    db.commit()

    return {"message": "Password reset successfully. You can now log in."}


@router.get("/validate-reset-token")
def validate_reset_token(token: str, db: Session = Depends(get_db)):
    """Check if a reset token is valid before showing the reset form."""
    user = db.execute(
        text("""
            SELECT id, reset_token_expires
            FROM users
            WHERE reset_token = :token AND is_active = TRUE
        """),
        {"token": token},
    ).mappings().first()

    if not user:
        return {"valid": False, "reason": "invalid"}

    expires = user["reset_token_expires"]
    if expires is None or datetime.now(timezone.utc) > expires:
        return {"valid": False, "reason": "expired"}

    return {"valid": True}