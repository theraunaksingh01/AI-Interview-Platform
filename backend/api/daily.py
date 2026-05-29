# backend/api/daily.py
"""
Daily Question API
GET  /api/daily/today        — today's question + user's answer status
POST /api/daily/answer       — submit answer, get score + better answer
GET  /api/daily/streak       — user's current streak + this week's status
"""

from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime, timedelta
from typing import Any, Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_current_user, get_current_user_optional
from db.session import SessionLocal
from db import models as db_models

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/daily", tags=["daily"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class AnswerPayload(BaseModel):
    transcript: str
    scheduled_date: Optional[str] = None  # ISO date string, defaults to today


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _score_answer(question_text: str, transcript: str, answer_framework: str, model_answer: str) -> dict:
    """Call Claude to score the daily answer. Returns score + better_answer."""
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return {"score": 50.0, "better_answer": model_answer, "feedback": {}}

    prompt = f"""You are evaluating a final-year Indian engineering student's answer to a daily practice question.

SCORING CALIBRATION:
- Incoherent/completely off-topic: 0-20
- Mentioned the concept but wrong: 20-40
- Partial understanding, some accuracy: 40-55
- Correct definition, no example: 55-70
- Correct with example, missing depth: 70-82
- Complete with example and trade-offs: 83-92
- Exceptional beyond campus level: 92-100
A genuine attempt at the right concept should never score below 40.

Question: {question_text}

Answer framework expected: {answer_framework}

Student's answer: {transcript}

Return ONLY valid JSON:
{{
  "score": <0-100 float>,
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific gap 1", "specific gap 2"],
  "summary": "<2 sentence honest assessment>",
  "better_answer": "<3-5 sentence model answer they could have given, natural spoken language>"
}}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = ""
        for block in getattr(response, "content", []):
            if getattr(block, "type", "") == "text":
                raw += getattr(block, "text", "")

        clean = raw.strip()
        if clean.startswith("```"):
            parts = clean.split("```")
            clean = parts[1] if len(parts) >= 2 else clean
            if clean.startswith("json"):
                clean = clean[4:]

        parsed = json.loads(clean.strip())
        return {
            "score": float(parsed.get("score", 50)),
            "better_answer": parsed.get("better_answer", model_answer),
            "feedback": {
                "strengths": parsed.get("strengths", []),
                "weaknesses": parsed.get("weaknesses", []),
                "summary": parsed.get("summary", ""),
            },
        }
    except Exception as e:
        log.warning("[DAILY] Scoring failed: %s", e)
        return {"score": 50.0, "better_answer": model_answer, "feedback": {}}


def _update_streak(db: Session, user_id: int, answer_date: date):
    """Update streak_days and longest_streak in user_progress."""
    try:
        yesterday = answer_date - timedelta(days=1)

        existing = db.execute(
            text("SELECT id, streak_days, longest_streak FROM user_progress WHERE user_id = :uid ORDER BY updated_at DESC LIMIT 1"),
            {"uid": user_id},
        ).mappings().first()

        # Check if answered yesterday
        prev_answer = db.execute(
            text("SELECT id FROM daily_answers WHERE user_id = :uid AND scheduled_date = :d"),
            {"uid": user_id, "d": yesterday},
        ).mappings().first()

        if existing:
            current_streak = int(existing["streak_days"] or 0)
            longest = int(existing["longest_streak"] or 0)
            new_streak = (current_streak + 1) if prev_answer else 1
            new_longest = max(longest, new_streak)
            db.execute(
                text("""
                    UPDATE user_progress
                    SET streak_days = :s, longest_streak = :l, updated_at = NOW()
                    WHERE id = :id
                """),
                {"s": new_streak, "l": new_longest, "id": existing["id"]},
            )
        else:
            db.execute(
                text("""
                    INSERT INTO user_progress (user_id, date, streak_days, longest_streak, updated_at)
                    VALUES (:uid, :d, 1, 1, NOW())
                """),
                {"uid": user_id, "d": answer_date},
            )
        db.commit()
    except Exception as e:
        log.warning("[DAILY] Streak update failed: %s", e)
        db.rollback()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/today")
def get_today(
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user_optional),
):
    """Return today's question and whether the current user has answered."""
    today = date.today()

    row = db.execute(
        text("""
            SELECT id, scheduled_date, question_text, topic, difficulty,
                   company_tag, answer_framework, model_answer
            FROM daily_questions
            WHERE scheduled_date = :d
        """),
        {"d": today},
    ).mappings().first()

    if not row:
        # Fallback: return the most recent available question
        row = db.execute(
            text("""
                SELECT id, scheduled_date, question_text, topic, difficulty,
                       company_tag, answer_framework, model_answer
                FROM daily_questions
                WHERE scheduled_date <= :d
                ORDER BY scheduled_date DESC
                LIMIT 1
            """),
            {"d": today},
        ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="No daily question available")

    # Check if user already answered
    answered = None
    if current_user:
        answer_row = db.execute(
            text("""
                SELECT score, transcript, ai_feedback, better_answer, answered_at
                FROM daily_answers
                WHERE user_id = :uid AND scheduled_date = :d
            """),
            {"uid": current_user.id, "d": today},
        ).mappings().first()

        if answer_row:
            feedback = answer_row["ai_feedback"]
            if isinstance(feedback, str):
                try:
                    feedback = json.loads(feedback)
                except Exception:
                    feedback = {}
            answered = {
                "score": float(answer_row["score"] or 0),
                "transcript": answer_row["transcript"],
                "feedback": feedback or {},
                "better_answer": answer_row["better_answer"],
                "answered_at": answer_row["answered_at"].isoformat() if answer_row["answered_at"] else None,
            }

    return {
        "question": {
            "id": row["id"],
            "scheduled_date": row["scheduled_date"].isoformat(),
            "question_text": row["question_text"],
            "topic": row["topic"],
            "difficulty": row["difficulty"],
            "company_tag": row["company_tag"],
            "answer_framework": row["answer_framework"],
        },
        "answered": answered,
        "date": today.isoformat(),
    }


@router.post("/answer")
def submit_answer(
    payload: AnswerPayload,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
):
    """Score and store a daily answer."""
    target_date = date.today()
    if payload.scheduled_date:
        try:
            target_date = date.fromisoformat(payload.scheduled_date)
        except ValueError:
            pass

    # Check already answered
    existing = db.execute(
        text("SELECT id FROM daily_answers WHERE user_id = :uid AND scheduled_date = :d"),
        {"uid": current_user.id, "d": target_date},
    ).mappings().first()
    if existing:
        raise HTTPException(status_code=400, detail="already_answered")

    # Get question
    row = db.execute(
        text("SELECT * FROM daily_questions WHERE scheduled_date = :d"),
        {"d": target_date},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Question not found")

    # Score with Claude
    result = _score_answer(
        question_text=row["question_text"],
        transcript=payload.transcript,
        answer_framework=row["answer_framework"] or "",
        model_answer=row["model_answer"] or "",
    )

    # Store answer
    db.execute(
        text("""
            INSERT INTO daily_answers
                (user_id, scheduled_date, score, transcript, ai_feedback, better_answer, answered_at)
            VALUES
                (:uid, :d, :score, :transcript, CAST(:feedback AS jsonb), :better, NOW())
        """),
        {
            "uid": current_user.id,
            "d": target_date,
            "score": result["score"],
            "transcript": payload.transcript,
            "feedback": json.dumps(result["feedback"]),
            "better": result["better_answer"],
        },
    )
    db.commit()

    # Update streak
    _update_streak(db, current_user.id, target_date)

    return {
        "ok": True,
        "score": result["score"],
        "better_answer": result["better_answer"],
        "feedback": result["feedback"],
        "model_answer": row["model_answer"],
    }


@router.get("/streak")
def get_streak(
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
):
    """Return streak info + this week's answer status."""
    today = date.today()

    # Get streak
    progress = db.execute(
        text("""
            SELECT streak_days, longest_streak
            FROM user_progress
            WHERE user_id = :uid
            ORDER BY updated_at DESC LIMIT 1
        """),
        {"uid": current_user.id},
    ).mappings().first()

    streak = int(progress["streak_days"] or 0) if progress else 0
    longest = int(progress["longest_streak"] or 0) if progress else 0

    # This week (Mon-Sun)
    week_start = today - timedelta(days=today.weekday())
    week_dates = [week_start + timedelta(days=i) for i in range(7)]

    answered_dates = db.execute(
        text("""
            SELECT scheduled_date FROM daily_answers
            WHERE user_id = :uid
              AND scheduled_date >= :start
              AND scheduled_date <= :end
        """),
        {"uid": current_user.id, "start": week_start, "end": week_dates[-1]},
    ).scalars().all()

    answered_set = {d.isoformat() if hasattr(d, "isoformat") else str(d) for d in answered_dates}

    week = []
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for i, d in enumerate(week_dates):
        week.append({
            "date": d.isoformat(),
            "day": day_names[i],
            "answered": d.isoformat() in answered_set,
            "is_today": d == today,
            "is_future": d > today,
        })

    # Total answers ever
    total = db.execute(
        text("SELECT COUNT(*) FROM daily_answers WHERE user_id = :uid"),
        {"uid": current_user.id},
    ).scalar() or 0

    return {
        "streak": streak,
        "longest_streak": longest,
        "total_answered": int(total),
        "week": week,
        "answered_today": today.isoformat() in answered_set,
    }