# backend/api/promo.py
# Promo codes: grant a time-limited Pro/Max plan (used for the "Founding 50" cohort).
# Register in main.py:
#   from api.promo import router as promo_api
#   app.include_router(promo_api)

import os
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.deps import get_current_user
from api.rate_limit import _check_rate_limit
from db.session import get_db

router = APIRouter(prefix="/api/promo", tags=["promo"])

FEEDBACK_URL = os.getenv("FOUNDING_FEEDBACK_URL", "")   # Google Form / Tally link
FEEDBACK_AFTER_DAYS = 3                                  # show the prompt after N days


class RedeemRequest(BaseModel):
    code: str


def _clean(code: str) -> str:
    return (code or "").strip().upper()


def apply_rate_limit_dep(request: Request):
    # 5 applications per hour per IP (public endpoint)
    _check_rate_limit(request, 5, 3600, "founding_apply")


class ApplyRequest(BaseModel):
    name: str
    email: str
    college: str
    city: str
    branch: str
    year: str
    next_test: str
    current_prep: Optional[str] = ""
    whatsapp: str
    agreed_feedback: bool = False
    agreed_contact: bool = False
    website: Optional[str] = None      # honeypot: real users leave this empty


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@router.post("/apply")
def apply_founding(
    payload: ApplyRequest,
    db: Session = Depends(get_db),
    _rl=Depends(apply_rate_limit_dep),
):
    """Public. Founding 50 application form."""
    ok_msg = {"success": True, "message": "Thanks! We will review your application and contact you in 1-2 days."}

    if payload.website:           # bot filled the hidden field: pretend success
        return ok_msg

    name = payload.name.strip()
    email = payload.email.strip().lower()
    whatsapp = re.sub(r"[^\d+]", "", payload.whatsapp or "")
    fields = {
        "name": name, "college": payload.college.strip(), "city": payload.city.strip(),
        "branch": payload.branch.strip(), "year": payload.year.strip(), "next_test": payload.next_test.strip(),
    }

    if not _EMAIL_RE.match(email) or len(email) > 254:
        raise HTTPException(status_code=400, detail="Please enter a valid email")
    if any(not v for v in fields.values()) or any(len(v) > 200 for v in fields.values()):
        raise HTTPException(status_code=400, detail="Please fill all required fields")
    if len(whatsapp) < 10 or len(whatsapp) > 15:
        raise HTTPException(status_code=400, detail="Please enter a valid WhatsApp number")
    if not (payload.agreed_feedback and payload.agreed_contact):
        raise HTTPException(status_code=400, detail="Please tick both boxes to apply")

    db.execute(
        text("""
            INSERT INTO founding_applications
                (name, email, college, city, branch, year, next_test, current_prep, whatsapp,
                 agreed_feedback, agreed_contact)
            VALUES (:name, :email, :college, :city, :branch, :year, :next_test, :prep, :wa, TRUE, TRUE)
            ON CONFLICT ((lower(email))) DO NOTHING
        """),
        {**fields, "email": email, "prep": (payload.current_prep or "").strip()[:500], "wa": whatsapp},
    )
    db.commit()
    return ok_msg    # same reply whether new or duplicate (does not reveal who applied)


@router.get("/validate/{code}")
def validate_code(code: str, db: Session = Depends(get_db)):
    """Public. Lets the signup / landing page show 'X of 50 spots left'."""
    row = db.execute(
        text("""
            SELECT label, grant_plan, grant_days, max_uses, uses, active, expires_at, require_accepted,
                   (expires_at IS NOT NULL AND expires_at < NOW()) AS expired
            FROM promo_codes WHERE code = :c
        """),
        {"c": _clean(code)},
    ).mappings().first()

    if not row:
        return {"valid": False, "reason": "not_found"}
    if not row["active"] or row["expired"]:
        return {"valid": False, "reason": "closed"}

    left = row["max_uses"] - row["uses"]
    if left <= 0:
        return {"valid": False, "reason": "full", "label": row["label"]}

    return {
        "valid": True,
        "label": row["label"],
        "plan": row["grant_plan"],
        "days": row["grant_days"],
        "spots_left": left,
        "max_uses": row["max_uses"],
        "require_accepted": row["require_accepted"],
    }


@router.post("/redeem")
def redeem_code(
    payload: RedeemRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    code = _clean(payload.code)
    if not code:
        raise HTTPException(status_code=400, detail="Code is required")

    # One promo per user
    already = db.execute(
        text("SELECT 1 FROM promo_redemptions WHERE user_id = :u"), {"u": current_user.id}
    ).first()
    if already:
        raise HTTPException(status_code=400, detail="You have already used a promo code")

    # Don't touch people who already have a plan (free only)
    plan = db.execute(
        text("SELECT plan FROM users WHERE id = :u"), {"u": current_user.id}
    ).scalar()
    if (plan or "free").lower() != "free":
        raise HTTPException(status_code=400, detail="You already have a paid plan")

    # Some codes (Founding 50) are only for accepted applicants
    gated = db.execute(
        text("SELECT require_accepted FROM promo_codes WHERE code = :c"), {"c": code}
    ).scalar()
    if gated:
        ok = db.execute(
            text("SELECT 1 FROM founding_applications WHERE lower(email) = lower(:e) AND status = 'accepted'"),
            {"e": current_user.email},
        ).first()
        if not ok:
            raise HTTPException(
                status_code=403,
                detail="This code is for accepted applicants. Apply at /founding and we will get back to you.",
            )

    # Atomic claim: only succeeds while spots remain (race-safe)
    row = db.execute(
        text("""
            UPDATE promo_codes
               SET uses = uses + 1
             WHERE code = :c
               AND active
               AND (expires_at IS NULL OR expires_at > NOW())
               AND uses < max_uses
         RETURNING id, label, grant_plan, grant_days
        """),
        {"c": code},
    ).mappings().first()

    if not row:
        db.rollback()
        raise HTTPException(status_code=410, detail="This code is invalid, closed, or all spots are taken")

    try:
        exp = db.execute(
            text("""
                INSERT INTO promo_redemptions (user_id, code_id, plan_granted, expires_at)
                VALUES (:u, :cid, :p, NOW() + make_interval(days => :d))
                RETURNING expires_at
            """),
            {"u": current_user.id, "cid": row["id"], "p": row["grant_plan"], "d": row["grant_days"]},
        ).scalar()

        db.execute(
            text("""
                UPDATE users
                   SET plan = :p, plan_expires_at = :exp, plan_source = 'promo'
                 WHERE id = :u
            """),
            {"p": row["grant_plan"], "exp": exp, "u": current_user.id},
        )
        db.execute(
            text("UPDATE founding_applications SET status = 'joined' WHERE lower(email) = lower(:e) AND status = 'accepted'"),
            {"e": current_user.email},
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="You have already used a promo code")

    return {
        "success": True,
        "message": f"{row['label']}: {row['grant_plan'].title()} unlocked for {row['grant_days']} days.",
        "plan": row["grant_plan"],
        "expires_at": exp.isoformat() if exp else None,
    }


@router.get("/my")
def my_promo(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Used by the dashboard to show days left and the feedback prompt."""
    r = db.execute(
        text("""
            SELECT r.plan_granted, r.expires_at, r.redeemed_at, r.feedback_done, c.label,
                   EXTRACT(DAY FROM (NOW() - r.redeemed_at))::int AS days_since,
                   GREATEST(0, CEIL(EXTRACT(EPOCH FROM (r.expires_at - NOW())) / 86400))::int AS days_left
            FROM promo_redemptions r JOIN promo_codes c ON c.id = r.code_id
            WHERE r.user_id = :u
        """),
        {"u": current_user.id},
    ).mappings().first()

    if not r:
        return {"redeemed": False}

    return {
        "redeemed": True,
        "label": r["label"],
        "plan": r["plan_granted"],
        "expires_at": r["expires_at"].isoformat(),
        "days_left": r["days_left"],
        "show_feedback": bool(FEEDBACK_URL) and not r["feedback_done"] and r["days_since"] >= FEEDBACK_AFTER_DAYS,
        "feedback_url": FEEDBACK_URL,
    }


@router.post("/feedback-done")
def feedback_done(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(
        text("UPDATE promo_redemptions SET feedback_done = TRUE WHERE user_id = :u"),
        {"u": current_user.id},
    )
    db.commit()
    return {"ok": True}


def expire_promo_plans(db: Session) -> int:
    """Downgrade expired promo plans back to free. Run daily (Celery beat or cron)."""
    res = db.execute(
        text("""
            UPDATE users
               SET plan = 'free', plan_expires_at = NULL, plan_source = NULL
             WHERE plan_source = 'promo'
               AND plan_expires_at IS NOT NULL
               AND plan_expires_at < NOW()
        """)
    )
    db.commit()
    return res.rowcount
