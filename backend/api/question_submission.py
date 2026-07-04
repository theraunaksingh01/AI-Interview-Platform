# backend/api/question_submission.py
from __future__ import annotations

import os
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_current_user_optional, get_current_user
from db.session import get_db, SessionLocal

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/questions", tags=["question-submission"])

CREDIT_CAP = 5  # max credits a user can hold at once

# ─── Schemas ──────────────────────────────────────────────────────────────────

class QuestionSubmitRequest(BaseModel):
    company: str = Field(min_length=2, max_length=255)
    role: str = Field(min_length=2, max_length=255)
    round_type: str          # hr | technical | managerial | aptitude
    interview_month: int = Field(ge=1, le=12)
    interview_year: int = Field(ge=2020, le=2030)
    question_text: str = Field(min_length=20, max_length=2000)
    answer_hint: Optional[str] = Field(None, max_length=1000)
    topic: Optional[str] = None
    force_submit: bool = False   # user confirmed duplicate warning

VALID_ROUND_TYPES = {"hr", "technical", "managerial", "aptitude"}
VALID_TOPICS = {"behavioural", "dsa", "system_design", "networking", "dbms", "os", "oops", "general"}


# ─── Duplicate check helper ───────────────────────────────────────────────────

def _check_duplicate(question_text: str, db: Session) -> Optional[dict]:
    """
    Simple similarity check — looks for questions with significant word overlap.
    Returns the matching row if found, else None.
    """
    # Grab first 80 chars as a rough fingerprint
    snippet = question_text.strip()[:80].lower()
    words = [w for w in snippet.split() if len(w) > 3]
    if not words:
        return None

    # Check submitted_questions
    existing = db.execute(
        text("""
            SELECT id, company, question_text
            FROM submitted_questions
            WHERE LOWER(question_text) LIKE :pattern
            LIMIT 1
        """),
        {"pattern": f"%{words[0]}%"},
    ).mappings().first()

    if existing:
        return dict(existing)

    # Check live questions table
    live = db.execute(
        text("""
            SELECT id, question_text
            FROM questions
            WHERE LOWER(question_text) LIKE :pattern
            LIMIT 1
        """),
        {"pattern": f"%{words[0]}%"},
    ).mappings().first()

    return dict(live) if live else None


# ─── Claude auto-review (runs as background task) ─────────────────────────────

def _claude_review(submission_id: int) -> None:
    """
    Ask Claude if this is a plausible real campus interview question.
    Updates claude_verdict and claude_reason on the submission.
    Auto-approves APPROVE verdicts from trusted contributors.
    """
    db = SessionLocal()
    try:
        row = db.execute(
            text("""
                SELECT sq.*, u.email,
                    (SELECT COUNT(*) FROM submitted_questions
                     WHERE user_id = sq.user_id AND status = 'approved') AS approved_count,
                    (SELECT COUNT(*) FROM submitted_questions
                     WHERE user_id = sq.user_id) AS total_count
                FROM submitted_questions sq
                JOIN users u ON u.id = sq.user_id
                WHERE sq.id = :id
            """),
            {"id": submission_id},
        ).mappings().first()

        if not row:
            return

        api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        if not api_key:
            log.warning("[QSUB] No ANTHROPIC_API_KEY — skipping Claude review")
            return

        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        prompt = f"""You are reviewing a student's submission of a real interview question they claim was asked at a campus placement drive.

Company: {row['company']}
Role: {row['role']}
Round: {row['round_type']}
Month/Year: {row['interview_month']}/{row['interview_year']}
Topic: {row['topic'] or 'not specified'}
Question: {row['question_text']}
Answer hint: {row['answer_hint'] or 'none provided'}

Evaluate:
1. Is this a plausible real interview question for this company and role?
2. Is it specific enough to be useful (not just "what is OOP")?
3. Does it seem copied from a study resource rather than a real interview?

Reply with ONLY valid JSON:
{{"verdict": "APPROVE" or "REJECT" or "MANUAL", "reason": "one sentence explanation"}}

APPROVE = clearly plausible and useful
REJECT = too vague, obviously fake, or copied from study material
MANUAL = borderline, needs human review"""

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )

        text_payload = ""
        for block in getattr(response, "content", []):
            if getattr(block, "type", "") == "text":
                text_payload += getattr(block, "text", "")

        parsed = json.loads(text_payload.strip())
        verdict = parsed.get("verdict", "MANUAL")
        reason = parsed.get("reason", "")

        # Trusted contributor: 5+ approved with >50% approval rate
        is_trusted = (
            int(row["approved_count"]) >= 5
            and int(row["total_count"]) > 0
            and int(row["approved_count"]) / int(row["total_count"]) >= 0.5
        )

        # Auto-approve if Claude says APPROVE and contributor is trusted
        new_status = "pending"
        if verdict == "APPROVE" and is_trusted:
            new_status = "approved"
        elif verdict == "REJECT":
            new_status = "rejected"

        db.execute(
            text("""
                UPDATE submitted_questions
                SET claude_verdict = :v, claude_reason = :r, status = :s
                WHERE id = :id
            """),
            {"v": verdict, "r": reason, "s": new_status, "id": submission_id},
        )
        db.commit()

        # If auto-approved, award credits
        if new_status == "approved":
            _award_credit(submission_id, int(row["user_id"]), db)

    except Exception as e:
        log.warning("[QSUB] Claude review failed for %s: %s", submission_id, e)
        db.rollback()
    finally:
        db.close()


def _award_credit(submission_id: int, user_id: int, db: Session) -> None:
    """Award 1 credit (capped at CREDIT_CAP). Create notification."""
    # Check current credits
    user_row = db.execute(
        text("SELECT session_credits FROM users WHERE id = :uid"),
        {"uid": user_id},
    ).mappings().first()

    if not user_row:
        return

    current = int(user_row["session_credits"] or 0)
    if current >= CREDIT_CAP:
        return  # already at cap — no credit but mark awarded to avoid retry

    db.execute(
        text("""
            UPDATE users
            SET session_credits = LEAST(session_credits + 1, :cap)
            WHERE id = :uid
        """),
        {"cap": CREDIT_CAP, "uid": user_id},
    )

    db.execute(
        text("""
            UPDATE submitted_questions
            SET credits_awarded = TRUE
            WHERE id = :id
        """),
        {"id": submission_id},
    )

    # Get company name for notification
    sq_row = db.execute(
        text("SELECT company, question_text FROM submitted_questions WHERE id = :id"),
        {"id": submission_id},
    ).mappings().first()

    company = sq_row["company"] if sq_row else "unknown"
    preview = (sq_row["question_text"] or "")[:60] if sq_row else ""

    db.execute(
        text("""
            INSERT INTO user_notifications (user_id, type, title, body)
            VALUES (:uid, 'question_approved', :title, :body)
        """),
        {
            "uid": user_id,
            "title": f"Your {company} question was approved! +1 credit added.",
            "body": f'"{preview}..." is now in our review queue.',
        },
    )

    db.commit()
    log.info("[QSUB] Awarded credit to user %s for submission %s", user_id, submission_id)


# ─── Submit question ──────────────────────────────────────────────────────────

@router.post("/submit")
def submit_question(
    payload: QuestionSubmitRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user_id = current_user.id

    # Validate enums
    if payload.round_type not in VALID_ROUND_TYPES:
        raise HTTPException(400, f"Invalid round_type. Must be one of: {', '.join(VALID_ROUND_TYPES)}")
    if payload.topic and payload.topic not in VALID_TOPICS:
        raise HTTPException(400, f"Invalid topic")

    # Duplicate check (unless user force-confirmed)
    if not payload.force_submit:
        duplicate = _check_duplicate(payload.question_text, db)
        if duplicate:
            return {
                "status": "duplicate_warning",
                "message": "A similar question already exists in our bank. If this is from a different company or year, submit anyway.",
                "existing_preview": (duplicate.get("question_text") or "")[:100],
            }

    # Insert
    row = db.execute(
        text("""
            INSERT INTO submitted_questions
                (user_id, company, role, round_type, interview_month,
                 interview_year, question_text, answer_hint, topic, status)
            VALUES
                (:uid, :company, :role, :round_type, :month,
                 :year, :question_text, :answer_hint, :topic, 'pending')
            RETURNING id
        """),
        {
            "uid": user_id,
            "company": payload.company.strip(),
            "role": payload.role.strip(),
            "round_type": payload.round_type,
            "month": payload.interview_month,
            "year": payload.interview_year,
            "question_text": payload.question_text.strip(),
            "answer_hint": (payload.answer_hint or "").strip() or None,
            "topic": payload.topic,
        },
    ).mappings().first()

    db.commit()

    submission_id = row["id"]

    # Queue Claude review as background task
    background_tasks.add_task(_claude_review, submission_id)

    return {
        "status": "submitted",
        "submission_id": submission_id,
        "message": "Question submitted — we'll review it within 48 hours. You'll get a credit when it's approved.",
    }


# ─── User: my submissions ─────────────────────────────────────────────────────

@router.get("/my-submissions")
def my_submissions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = db.execute(
        text("""
            SELECT id, company, role, round_type, interview_month, interview_year,
                   question_text, topic, status, claude_verdict, credits_awarded, created_at
            FROM submitted_questions
            WHERE user_id = :uid
            ORDER BY created_at DESC
            LIMIT 50
        """),
        {"uid": current_user.id},
    ).mappings().all()

    return {"submissions": [dict(r) for r in rows]}


# ─── Notifications ────────────────────────────────────────────────────────────

@router.get("/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = db.execute(
        text("""
            SELECT id, type, title, body, read, created_at
            FROM user_notifications
            WHERE user_id = :uid
            ORDER BY created_at DESC
            LIMIT 20
        """),
        {"uid": current_user.id},
    ).mappings().all()

    unread_count = sum(1 for r in rows if not r["read"])
    return {"notifications": [dict(r) for r in rows], "unread_count": unread_count}


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    db.execute(
        text("""
            UPDATE user_notifications SET read = TRUE
            WHERE id = :id AND user_id = :uid
        """),
        {"id": notification_id, "uid": current_user.id},
    )
    db.commit()
    return {"ok": True}


# ─── Credits ──────────────────────────────────────────────────────────────────

@router.get("/credits")
def get_credits(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = db.execute(
        text("SELECT session_credits FROM users WHERE id = :uid"),
        {"uid": current_user.id},
    ).mappings().first()
    return {"credits": int(row["session_credits"] or 0) if row else 0}


# ─── Admin: list submissions ──────────────────────────────────────────────────

@router.get("/admin/submissions")
def admin_list_submissions(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    if not getattr(current_user, "is_superuser", False):
        raise HTTPException(403, "Admin only")

    where = "WHERE 1=1"
    params: dict = {"limit": limit, "offset": offset}
    if status:
        where += " AND sq.status = :status"
        params["status"] = status

    rows = db.execute(
        text(f"""
            SELECT
                sq.*,
                u.email AS user_email,
                (SELECT COUNT(*) FROM submitted_questions
                 WHERE user_id = sq.user_id AND status = 'approved') AS user_approved_count,
                (SELECT COUNT(*) FROM submitted_questions
                 WHERE user_id = sq.user_id) AS user_total_count
            FROM submitted_questions sq
            JOIN users u ON u.id = sq.user_id
            {where}
            ORDER BY sq.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).mappings().all()

    total = db.execute(
        text(f"SELECT COUNT(*) FROM submitted_questions sq {where}"),
        {k: v for k, v in params.items() if k not in ("limit", "offset")},
    ).scalar()

    return {"total": total, "items": [dict(r) for r in rows]}


# ─── Admin: approve / reject / duplicate / promote ───────────────────────────

class AdminActionRequest(BaseModel):
    action: str   # approve | reject | duplicate | promote


@router.post("/admin/submissions/{submission_id}/action")
def admin_submission_action(
    submission_id: int,
    payload: AdminActionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    if not getattr(current_user, "is_superuser", False):
        raise HTTPException(403, "Admin only")

    row = db.execute(
        text("SELECT * FROM submitted_questions WHERE id = :id"),
        {"id": submission_id},
    ).mappings().first()

    if not row:
        raise HTTPException(404, "Submission not found")

    action = payload.action

    if action == "approve":
        db.execute(
            text("""
                UPDATE submitted_questions
                SET status = 'approved', reviewed_by = :rv, reviewed_at = NOW()
                WHERE id = :id
            """),
            {"rv": current_user.id, "id": submission_id},
        )
        db.commit()

        # Award credit if not already done
        if not row["credits_awarded"]:
            _award_credit(submission_id, int(row["user_id"]), db)

    elif action == "reject":
        db.execute(
            text("""
                UPDATE submitted_questions
                SET status = 'rejected', reviewed_by = :rv, reviewed_at = NOW()
                WHERE id = :id
            """),
            {"rv": current_user.id, "id": submission_id},
        )
        db.commit()

    elif action == "duplicate":
        db.execute(
            text("""
                UPDATE submitted_questions
                SET status = 'duplicate', reviewed_by = :rv, reviewed_at = NOW()
                WHERE id = :id
            """),
            {"rv": current_user.id, "id": submission_id},
        )
        db.commit()

    elif action == "promote":
        # Promote to live questions table
        db.execute(
            text("""
                INSERT INTO questions
                    (question_text, topic, difficulty, company_tag,
                     answer_framework, source, created_at)
                VALUES
                    (:qt, :topic, 2, :company, :hint, 'community', NOW())
                ON CONFLICT DO NOTHING
            """),
            {
                "qt": row["question_text"],
                "topic": row["topic"] or "general",
                "company": row["company"].lower(),
                "hint": row["answer_hint"] or "",
            },
        )
        db.execute(
            text("""
                UPDATE submitted_questions
                SET status = 'approved', reviewed_by = :rv, reviewed_at = NOW()
                WHERE id = :id
            """),
            {"rv": current_user.id, "id": submission_id},
        )
        db.commit()

        if not row["credits_awarded"]:
            _award_credit(submission_id, int(row["user_id"]), db)

    else:
        raise HTTPException(400, f"Unknown action: {action}")

    return {"ok": True, "action": action}


# ─── Admin: bulk approve ──────────────────────────────────────────────────────

class BulkApproveRequest(BaseModel):
    submission_ids: list[int]


@router.post("/admin/submissions/bulk-approve")
def bulk_approve(
    payload: BulkApproveRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    if not getattr(current_user, "is_superuser", False):
        raise HTTPException(403, "Admin only")

    approved = []
    for sid in payload.submission_ids:
        row = db.execute(
            text("SELECT * FROM submitted_questions WHERE id = :id AND status = 'pending'"),
            {"id": sid},
        ).mappings().first()

        if not row:
            continue

        db.execute(
            text("""
                UPDATE submitted_questions
                SET status = 'approved', reviewed_by = :rv, reviewed_at = NOW()
                WHERE id = :id
            """),
            {"rv": current_user.id, "id": sid},
        )
        db.commit()

        if not row["credits_awarded"]:
            _award_credit(sid, int(row["user_id"]), db)

        approved.append(sid)

    return {"ok": True, "approved_count": len(approved), "approved_ids": approved}


# ─── Credit check helper (used by mock session start) ────────────────────────

def consume_credit_if_available(user_id: int, db: Session) -> bool:
    """
    Returns True if a credit was consumed (allow the session).
    Returns False if no credits available.
    """
    row = db.execute(
        text("SELECT session_credits FROM users WHERE id = :uid FOR UPDATE"),
        {"uid": user_id},
    ).mappings().first()

    if not row or int(row["session_credits"] or 0) <= 0:
        return False

    db.execute(
        text("UPDATE users SET session_credits = session_credits - 1 WHERE id = :uid"),
        {"uid": user_id},
    )
    db.commit()
    return True