# backend/api/assessment.py
from __future__ import annotations

import json
import random
import secrets
from typing import Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.session import get_db
from api.deps import get_current_user
from api.rate_limit import assessment_rate_limit

router = APIRouter(prefix="/api/assessment", tags=["assessment"])

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _section_label(score: float) -> str:
    if score >= 75: return "Strong"
    if score >= 50: return "Developing"
    if score >= 25: return "Needs Work"
    return "Not Ready"

def _overall_label(score: float) -> str:
    if score >= 75: return "Well Prepared"
    if score >= 50: return "Good Progress"
    if score >= 25: return "Building Foundation"
    return "Just Starting"

def _biggest_gap(section_scores: dict) -> str:
    # Weighted importance per section
    weights = {
        "aptitude": 0.25,
        "cs_fundamentals": 0.30,
        "programming_dsa": 0.25,
        "communication": 0.20,
    }
    worst = min(section_scores, key=lambda s: section_scores[s] * weights.get(s, 1))
    return worst

# ─── Schemas ─────────────────────────────────────────────────────────────────

class StartAssessmentResponse(BaseModel):
    attempt_id: int
    guest_token: str
    questions: dict  # {section: [{id, question_text, options, section, topic}]}

class SubmitAnswersRequest(BaseModel):
    attempt_id: int
    guest_token: str
    answers: list[dict]           # [{question_id, selected_option, time_sec}]
    voice_transcript: Optional[str] = None
    voice_duration_sec: Optional[int] = None
    self_assessment: Optional[dict] = None
    target_companies: Optional[list[str]] = None
    placement_months_away: Optional[int] = None

class ClaimAttemptRequest(BaseModel):
    guest_token: str
    attempt_id: int

# ─── Routes ──────────────────────────────────────────────────────────────────

@router.post("/start")
@assessment_rate_limit()
def start_assessment(request: Request, db: Session = Depends(get_db)):
    """
    Start a new assessment attempt — no auth required.
    Returns a guest_token stored in localStorage, and the question set.
    """
    # Pick 8 random questions from each MCQ section
    sections = ["aptitude", "cs_fundamentals", "programming_dsa"]
    questions_by_section = {}

    for section in sections:
        rows = db.execute(
            text("""
                SELECT id, question_text, options, section, topic
                FROM assessment_questions
                WHERE section = :section AND is_active = TRUE
                ORDER BY RANDOM()
                LIMIT 8
            """),
            {"section": section},
        ).mappings().all()

        questions_by_section[section] = [
            {
                "id": r["id"],
                "question_text": r["question_text"],
                "options": r["options"] if isinstance(r["options"], list)
                           else json.loads(r["options"]),
                "section": r["section"],
                "topic": r["topic"],
            }
            for r in rows
        ]

    # Create attempt record with guest_token
    guest_token = secrets.token_urlsafe(32)

    result = db.execute(
        text("""
            INSERT INTO assessment_attempts
                (guest_token, status)
            VALUES (:token, 'in_progress')
            RETURNING id
        """),
        {"token": guest_token},
    ).fetchone()
    db.commit()

    return {
        "attempt_id": result[0],
        "guest_token": guest_token,
        "questions": questions_by_section,
        "total_mcq": sum(len(v) for v in questions_by_section.values()),
    }


@router.post("/submit")
def submit_assessment(
    payload: SubmitAnswersRequest,
    db: Session = Depends(get_db),
):
    """
    Submit answers — no auth required.
    Scores the MCQ sections, evaluates voice if transcript provided,
    saves results. Student must then log in to view results.
    """
    # Verify attempt exists and is in_progress
    attempt = db.execute(
        text("""
            SELECT id, status FROM assessment_attempts
            WHERE id = :id AND guest_token = :token
        """),
        {"id": payload.attempt_id, "token": payload.guest_token},
    ).fetchone()

    if not attempt:
        raise HTTPException(404, "Assessment attempt not found")
    if attempt[1] == "completed":
        raise HTTPException(400, "Assessment already submitted")

    # ── Score MCQ answers ──────────────────────────────────────────────────
    if not payload.answers:
        raise HTTPException(400, "No answers provided")

    question_ids = [a["question_id"] for a in payload.answers]
    correct_map = {}

    if question_ids:
        rows = db.execute(
            text("""
                SELECT id, correct_option, section
                FROM assessment_questions
                WHERE id = ANY(:ids)
            """),
            {"ids": question_ids},
        ).mappings().all()
        correct_map = {r["id"]: (r["correct_option"], r["section"]) for r in rows}

    section_scores: dict[str, dict] = {
        "aptitude":        {"correct": 0, "total": 0},
        "cs_fundamentals": {"correct": 0, "total": 0},
        "programming_dsa": {"correct": 0, "total": 0},
    }

    enriched_answers = []
    for ans in payload.answers:
        qid = ans["question_id"]
        selected = ans.get("selected_option")
        if qid not in correct_map:
            continue
        correct_opt, section = correct_map[qid]
        is_correct = selected == correct_opt
        if section in section_scores:
            section_scores[section]["total"] += 1
            if is_correct:
                section_scores[section]["correct"] += 1
        enriched_answers.append({
            **ans,
            "correct": correct_opt,
            "is_correct": is_correct,
        })

    # Convert to percentages
    pct_scores = {}
    for section, data in section_scores.items():
        total = data["total"]
        pct_scores[section] = round(
            (data["correct"] / total * 100) if total > 0 else 0
        )

    # ── Evaluate voice if transcript provided ──────────────────────────────
    voice_evaluation = None
    if payload.voice_transcript and len(payload.voice_transcript.strip()) > 10:
        try:
            client = anthropic.Anthropic()
            duration = payload.voice_duration_sec or 0
            resp = client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=300,
                messages=[{
                    "role": "user",
                    "content": f"""A student recorded their "Tell me about yourself" response for a placement interview diagnostic.

Transcript: "{payload.voice_transcript}"
Duration: {duration} seconds

Evaluate and return ONLY valid JSON, no other text:
{{
  "structure": <0-10>,
  "clarity": <0-10>,
  "filler_count": <integer>,
  "length_appropriate": <true or false>,
  "feedback": "<one sentence on what to improve>"
}}"""
                }]
            )
            raw = resp.content[0].text.strip()
            voice_evaluation = json.loads(raw)
            # Convert to 0-100 score for section_scores
            comm_score = round(
                (voice_evaluation["structure"] + voice_evaluation["clarity"]) / 2 * 10
            )
            pct_scores["communication"] = comm_score
        except Exception:
            pct_scores["communication"] = 0
    else:
        pct_scores["communication"] = 0

    # ── Overall score ──────────────────────────────────────────────────────
    weights = {
        "aptitude": 0.25,
        "cs_fundamentals": 0.30,
        "programming_dsa": 0.25,
        "communication": 0.20,
    }
    total_score = round(sum(
        pct_scores.get(s, 0) * w for s, w in weights.items()
    ))

    biggest_gap = _biggest_gap(pct_scores)

    # ── Save results ───────────────────────────────────────────────────────
    db.execute(
        text("""
            UPDATE assessment_attempts SET
                total_score           = :total,
                section_scores        = :sections,
                answers               = :answers,
                voice_transcript      = :transcript,
                voice_evaluation      = :voice_eval,
                self_assessment       = :self_assess,
                target_companies      = :companies,
                placement_months_away = :months,
                biggest_gap           = :gap,
                status                = 'completed'
            WHERE id = :id
        """),
        {
            "total":       total_score,
            "sections":    json.dumps(pct_scores),
            "answers":     json.dumps(enriched_answers),
            "transcript":  payload.voice_transcript,
            "voice_eval":  json.dumps(voice_evaluation) if voice_evaluation else None,
            "self_assess": json.dumps(payload.self_assessment) if payload.self_assessment else None,
            "companies":   payload.target_companies or [],
            "months":      payload.placement_months_away,
            "gap":         biggest_gap,
            "id":          payload.attempt_id,
        },
    )
    db.commit()

    # Return minimal info — full results only after login
    return {
        "attempt_id": payload.attempt_id,
        "guest_token": payload.guest_token,
        "status": "completed",
        "preview": {
            "total_score": total_score,
            "label": _overall_label(total_score),
            "biggest_gap": biggest_gap,
        }
    }


@router.post("/claim")
def claim_attempt(
    payload: ClaimAttemptRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    After login/signup, link the guest attempt to the authenticated user.
    Called automatically after auth when guest_token is in localStorage.
    """
    result = db.execute(
        text("""
            UPDATE assessment_attempts
            SET user_id = :uid
            WHERE id = :id
              AND guest_token = :token
              AND (user_id IS NULL OR user_id = :uid)
            RETURNING id
        """),
        {
            "uid":   current_user.id,
            "id":    payload.attempt_id,
            "token": payload.guest_token,
        },
    ).fetchone()
    db.commit()

    if not result:
        raise HTTPException(404, "Attempt not found or already claimed")

    return {"ok": True, "attempt_id": payload.attempt_id}


@router.get("/results/{attempt_id}")
def get_results(
    attempt_id: int,
    guest_token: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get full assessment results — requires auth.
    Accepts either user_id match OR guest_token match (for just-registered users).
    """
    # Try user_id match first
    row = db.execute(
        text("""
            SELECT * FROM assessment_attempts
            WHERE id = :id AND user_id = :uid AND status = 'completed'
        """),
        {"id": attempt_id, "uid": current_user.id},
    ).mappings().first()

    # Fallback: guest_token match — auto-claim and return
    if not row and guest_token:
        row = db.execute(
            text("""
                SELECT * FROM assessment_attempts
                WHERE id = :id AND guest_token = :token AND status = 'completed'
            """),
            {"id": attempt_id, "token": guest_token},
        ).mappings().first()
        if row:
            # Auto-claim
            db.execute(
                text("UPDATE assessment_attempts SET user_id = :uid WHERE id = :id"),
                {"uid": current_user.id, "id": attempt_id},
            )
            db.commit()

    if not row:
        raise HTTPException(404, "Results not found")

    data = dict(row)
    section_scores = data.get("section_scores") or {}
    if isinstance(section_scores, str):
        section_scores = json.loads(section_scores)

    total = data.get("total_score") or 0
    biggest_gap = data.get("biggest_gap") or ""
    target_companies = data.get("target_companies") or []

    # Build company match analysis
    company_match = _build_company_match(
        target_companies, section_scores, total
    )

    # Build recommendations
    recommendations = _build_recommendations(
        biggest_gap, section_scores, target_companies
    )

    return {
        "attempt_id":           attempt_id,
        "total_score":          round(total),
        "label":                _overall_label(total),
        "section_scores":       {
            k: {"score": v, "label": _section_label(v)}
            for k, v in section_scores.items()
        },
        "biggest_gap":          biggest_gap,
        "voice_evaluation":     data.get("voice_evaluation"),
        "target_companies":     target_companies,
        "placement_months_away": data.get("placement_months_away"),
        "company_match":        company_match,
        "recommendations":      recommendations,
        "created_at":           str(data.get("created_at", "")),
    }


@router.get("/latest")
def get_latest_attempt(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get the most recent completed attempt for the logged-in user."""
    row = db.execute(
        text("""
            SELECT id, total_score, section_scores, biggest_gap, created_at
            FROM assessment_attempts
            WHERE user_id = :uid AND status = 'completed'
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"uid": current_user.id},
    ).mappings().first()

    if not row:
        return {"attempt": None}

    return {"attempt": dict(row)}


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _build_company_match(
    companies: list[str],
    scores: dict,
    total: float,
) -> list[dict]:
    """Simple rule-based company match analysis."""
    COMPANY_REQUIREMENTS = {
        "tcs": {
            "aptitude_min": 60,
            "cs_min": 50,
            "dsa_min": 40,
            "note_pass": "On track for Ninja. Score 70%+ aptitude for Digital.",
            "note_borderline": "Aptitude needs work for Ninja cutoff (~65-70%).",
            "note_fail": "Focus on DBMS and aptitude first.",
        },
        "infosys": {
            "aptitude_min": 55,
            "cs_min": 60,
            "dsa_min": 45,
            "note_pass": "On track for SE. CS fundamentals strong.",
            "note_borderline": "OOP and DBMS need improvement for technical round.",
            "note_fail": "CS fundamentals too weak. Focus on OOP and DBMS.",
        },
        "wipro": {
            "aptitude_min": 55,
            "cs_min": 45,
            "dsa_min": 40,
            "note_pass": "Good standing. Practice written communication test.",
            "note_borderline": "Aptitude borderline. Practice more quant questions.",
            "note_fail": "Need stronger aptitude and communication skills.",
        },
        "cognizant": {
            "aptitude_min": 55,
            "cs_min": 55,
            "dsa_min": 45,
            "note_pass": "On track for GenC. Strong project explanation will help.",
            "note_borderline": "OOP needs work — Cognizant tests it heavily.",
            "note_fail": "CS fundamentals and project explanation need focus.",
        },
        "amazon": {
            "aptitude_min": 70,
            "cs_min": 70,
            "dsa_min": 80,
            "note_pass": "DSA strong. Focus on Leadership Principles next.",
            "note_borderline": "DSA needs significant improvement for SDE-1.",
            "note_fail": "Overall coverage too low. Need 3-4 months of DSA prep.",
        },
        "microsoft": {
            "aptitude_min": 70,
            "cs_min": 65,
            "dsa_min": 80,
            "note_pass": "Strong foundation. Practice thinking out loud while coding.",
            "note_borderline": "DSA needs improvement. Study trees, graphs, and DP.",
            "note_fail": "Need stronger DSA and problem-solving approach.",
        },
    }

    apt  = scores.get("aptitude", 0)
    cs   = scores.get("cs_fundamentals", 0)
    dsa  = scores.get("programming_dsa", 0)

    result = []
    for company in (companies or []):
        slug = company.lower().replace(" ", "")
        req  = COMPANY_REQUIREMENTS.get(slug)
        if not req:
            continue

        apt_ok = apt  >= req["aptitude_min"]
        cs_ok  = cs   >= req["cs_min"]
        dsa_ok = dsa  >= req["dsa_min"]

        if apt_ok and cs_ok and dsa_ok:
            status = "on_track"
            note   = req["note_pass"]
        elif sum([apt_ok, cs_ok, dsa_ok]) >= 2:
            status = "borderline"
            note   = req["note_borderline"]
        else:
            status = "needs_work"
            note   = req["note_fail"]

        result.append({
            "company": company,
            "status":  status,
            "note":    note,
        })

    return result


def _build_recommendations(
    biggest_gap: str,
    scores: dict,
    companies: list[str],
) -> list[dict]:
    """Return 2-3 actionable next steps based on scores."""
    recs = []

    GAP_RECS = {
        "cs_fundamentals": {
            "title": "Practice CS fundamentals",
            "desc":  "Focus on DBMS normalization, OOP pillars, and OS process management — these are the most tested topics in technical interviews.",
            "cta":   "Start mock interview",
            "href":  "/mock",
        },
        "aptitude": {
            "title": "Take an OA practice test",
            "desc":  "Your aptitude score needs improvement. TCS NQT and Infosys SE both require ~65-70% aptitude. Practice timed questions daily.",
            "cta":   "Practice OA test",
            "href":  "/oa-practice",
        },
        "programming_dsa": {
            "title": "Build DSA fundamentals",
            "desc":  "Start with arrays, strings, and hashmaps. Solve 2-3 problems daily. Pattern recognition improves fast with consistent practice.",
            "cta":   "Go to DSA practice",
            "href":  "/dsa",
        },
        "communication": {
            "title": "Practice speaking answers out loud",
            "desc":  "Your communication needs work. The ability to explain clearly under pressure is a separate skill from knowing the answer.",
            "cta":   "Start mock interview",
            "href":  "/mock",
        },
    }

    # First recommendation: biggest gap
    if biggest_gap and biggest_gap in GAP_RECS:
        recs.append(GAP_RECS[biggest_gap])

    # Second: if communication < 50 and not already first rec
    comm_score = scores.get("communication", 0)
    if comm_score < 50 and biggest_gap != "communication":
        recs.append(GAP_RECS["communication"])

    # Third: always recommend a mock interview if not already added
    if not any(r["href"] == "/mock" for r in recs):
        recs.append({
            "title": "Take your first mock interview",
            "desc":  "See how you perform under real interview pressure. The coaching report after each session shows exactly what to fix.",
            "cta":   "Start mock interview",
            "href":  "/mock",
        })

    return recs[:3]