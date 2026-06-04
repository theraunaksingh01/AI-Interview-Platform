# backend/api/calendar.py
"""
Interview Calendar API
POST /api/calendar/set    — save interview date + generate prep plan
GET  /api/calendar/my     — get current calendar + plan
DELETE /api/calendar/my   — clear calendar
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

from api.deps import get_current_user
from db.session import SessionLocal

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/calendar", tags=["calendar"])

# ─── Companies ────────────────────────────────────────────────────────────────

COMPANIES = {
    "tcs":         { "name": "TCS",         "type": "service",  "rounds": ["Aptitude", "Technical", "HR"],                    "focus": ["dsa", "behavioral", "verbal"] },
    "infosys":     { "name": "Infosys",      "type": "service",  "rounds": ["InfyTQ", "Technical", "HR"],                     "focus": ["dsa", "behavioral", "system-design"] },
    "wipro":       { "name": "Wipro",        "type": "service",  "rounds": ["Aptitude", "Technical", "HR"],                   "focus": ["dsa", "behavioral"] },
    "cognizant":   { "name": "Cognizant",    "type": "service",  "rounds": ["Aptitude", "Technical", "HR"],                   "focus": ["dsa", "behavioral"] },
    "amazon":      { "name": "Amazon",       "type": "product",  "rounds": ["OA", "Technical x2", "System Design", "Bar Raiser"], "focus": ["dsa", "system-design", "behavioral"] },
    "microsoft":   { "name": "Microsoft",    "type": "product",  "rounds": ["OA", "Technical x3", "Manager"],                 "focus": ["dsa", "system-design", "behavioral"] },
    "google":      { "name": "Google",       "type": "faang",    "rounds": ["OA", "Technical x4", "Googliness"],              "focus": ["dsa", "system-design", "behavioral"] },
    "flipkart":    { "name": "Flipkart",     "type": "product",  "rounds": ["OA", "Technical x2", "System Design"],           "focus": ["dsa", "system-design"] },
    "razorpay":    { "name": "Razorpay",     "type": "startup",  "rounds": ["Technical x2", "System Design", "Culture"],      "focus": ["dsa", "system-design", "behavioral"] },
    "swiggy":      { "name": "Swiggy",       "type": "startup",  "rounds": ["Technical x2", "System Design"],                 "focus": ["dsa", "system-design"] },
    "startup":     { "name": "Startup",      "type": "startup",  "rounds": ["Technical", "Culture Fit"],                      "focus": ["dsa", "behavioral"] },
    "general":     { "name": "General prep", "type": "general",  "rounds": ["Technical", "HR"],                               "focus": ["dsa", "system-design", "behavioral"] },
}

# ─── Schemas ──────────────────────────────────────────────────────────────────

class CalendarSetPayload(BaseModel):
    company: str
    role_target: str
    interview_date: str  # ISO date string YYYY-MM-DD


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _days_remaining(interview_date: date) -> int:
    return max(0, (interview_date - date.today()).days)


def _generate_prep_plan(
    company: str,
    role_target: str,
    interview_date: date,
    days: int,
) -> dict[str, Any]:
    """Generate a day-by-day prep plan using Claude."""

    company_info = COMPANIES.get(company.lower(), COMPANIES["general"])
    focus_areas = company_info["focus"]
    rounds = company_info["rounds"]

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key or days == 0:
        return _fallback_plan(days, focus_areas, interview_date)

    prompt = f"""You are an interview prep coach for Indian engineering students.

Student's interview details:
- Company: {company_info['name']}
- Role: {role_target}
- Interview date: {interview_date.isoformat()}
- Days remaining: {days}
- Interview rounds: {', '.join(rounds)}
- Key focus areas: {', '.join(focus_areas)}

Generate a realistic day-by-day prep plan. Rules:
- If <= 3 days: focus only on most critical topics, 1 session/day
- If 4-7 days: 1-2 sessions/day, cover all focus areas
- If 8-14 days: structured progression, start fundamentals → depth → mock sessions
- If > 14 days: full preparation arc with revision cycles

Return ONLY valid JSON in this exact format:
{{
  "summary": "<2 sentence overview of the plan>",
  "coach_note": "<1 honest sentence about their situation given the timeline>",
  "daily_plan": [
    {{
      "day": 1,
      "date": "YYYY-MM-DD",
      "title": "<short title like 'DSA Fundamentals'>",
      "topic": "<dsa|system-design|behavioral|networking|general>",
      "task": "<specific 1-sentence task to do today>",
      "session_type": "<mock|practice|review>",
      "is_interview_day": false
    }}
  ],
  "key_topics": ["topic1", "topic2", "topic3"],
  "company_tips": ["tip1", "tip2"]
}}

Include the interview day itself as the last entry with is_interview_day: true.
Keep daily_plan concise — max {min(days + 1, 20)} entries."""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
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

        return json.loads(clean.strip())
    except Exception as e:
        log.warning("[CALENDAR] Plan generation failed: %s", e)
        return _fallback_plan(days, focus_areas, interview_date)


def _fallback_plan(days: int, focus_areas: list, interview_date: date) -> dict:
    """Simple fallback plan when Claude is unavailable."""
    topics = focus_areas * 3  # repeat to fill days
    daily_plan = []

    for i in range(min(days, 14)):
        d = date.today() + timedelta(days=i)
        topic = topics[i % len(topics)] if topics else "general"
        daily_plan.append({
            "day": i + 1,
            "date": d.isoformat(),
            "title": topic.replace("-", " ").title(),
            "topic": topic,
            "task": f"Complete one {topic.replace('-', ' ')} practice session",
            "session_type": "practice" if i < days - 1 else "mock",
            "is_interview_day": False,
        })

    # Add interview day
    daily_plan.append({
        "day": days,
        "date": interview_date.isoformat(),
        "title": "Interview Day",
        "topic": "general",
        "task": "Review your weakest topic one last time. Stay calm.",
        "session_type": "review",
        "is_interview_day": True,
    })

    return {
        "summary": f"Focused {days}-day prep plan covering {', '.join(focus_areas)}.",
        "coach_note": "Consistency matters more than intensity. One session per day is better than cramming.",
        "daily_plan": daily_plan,
        "key_topics": focus_areas,
        "company_tips": ["Practice speaking answers out loud", "Time your answers to under 90 seconds"],
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/set")
def set_calendar(
    payload: CalendarSetPayload,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Save interview date and generate prep plan."""
    try:
        interview_date = date.fromisoformat(payload.interview_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    if interview_date < date.today():
        raise HTTPException(status_code=400, detail="Interview date must be in the future.")

    days = _days_remaining(interview_date)
    company_key = payload.company.lower().replace(" ", "")
    company_info = COMPANIES.get(company_key, COMPANIES["general"])

    # Generate plan
    plan = _generate_prep_plan(
        company=company_key,
        role_target=payload.role_target,
        interview_date=interview_date,
        days=days,
    )

    # Upsert into interview_calendar
    db.execute(
        text("""
            INSERT INTO interview_calendar
                (user_id, company, role_target, interview_date, days_remaining, prep_plan, updated_at)
            VALUES
                (:uid, :company, :role, :date, :days, CAST(:plan AS jsonb), NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                company = EXCLUDED.company,
                role_target = EXCLUDED.role_target,
                interview_date = EXCLUDED.interview_date,
                days_remaining = EXCLUDED.days_remaining,
                prep_plan = EXCLUDED.prep_plan,
                updated_at = NOW()
        """),
        {
            "uid": current_user.id,
            "company": company_info["name"],
            "role": payload.role_target,
            "date": interview_date,
            "days": days,
            "plan": json.dumps(plan),
        },
    )
    db.commit()

    return {
        "ok": True,
        "days_remaining": days,
        "company": company_info["name"],
        "role_target": payload.role_target,
        "interview_date": interview_date.isoformat(),
        "plan": plan,
    }


@router.get("/my")
def get_my_calendar(
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Get current interview calendar."""
    row = db.execute(
        text("""
            SELECT id, company, role_target, interview_date,
                   prep_plan, coach_note, created_at, updated_at
            FROM interview_calendar
            WHERE user_id = :uid
        """),
        {"uid": current_user.id},
    ).mappings().first()

    if not row:
        return {"exists": False}

    interview_date = row["interview_date"]
    days = _days_remaining(interview_date)

    # Recalculate days_remaining daily
    db.execute(
        text("UPDATE interview_calendar SET days_remaining = :d WHERE user_id = :uid"),
        {"d": days, "uid": current_user.id},
    )
    db.commit()

    plan = row["prep_plan"] or {}

    # Mark today's task
    today_str = date.today().isoformat()
    today_task = None
    if isinstance(plan, dict) and "daily_plan" in plan:
        for entry in plan["daily_plan"]:
            if entry.get("date") == today_str:
                today_task = entry
                break

    return {
        "exists": True,
        "company": row["company"],
        "role_target": row["role_target"],
        "interview_date": interview_date.isoformat(),
        "days_remaining": days,
        "plan": plan,
        "today_task": today_task,
        "coach_note": row["coach_note"],
        "is_past": days == 0,
    }


@router.delete("/my")
def delete_calendar(
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Clear the interview calendar."""
    db.execute(
        text("DELETE FROM interview_calendar WHERE user_id = :uid"),
        {"uid": current_user.id},
    )
    db.commit()
    return {"ok": True}


@router.get("/companies")
def get_companies() -> dict:
    """Return list of supported companies."""
    return {
        "companies": [
            {"key": k, "name": v["name"], "type": v["type"]}
            for k, v in COMPANIES.items()
        ]
    }