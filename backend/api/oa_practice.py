# backend/api/oa_practice.py
from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.session import get_db
from api.deps import get_current_user
from api.rate_limit import rate_limit
from fastapi import Request

router = APIRouter(prefix="/api/oa", tags=["oa_practice"])

# ─── Company configs ──────────────────────────────────────────────────────────

OA_CONFIGS = {
    "tcs": {
        "name": "TCS NQT",
        "full_name": "TCS National Qualifier Test",
        "total_time_min": 190,
        "tracks": ["foundation"],
        "sections": {
            "foundation": [
                {"key": "numerical",  "label": "Numerical Ability",  "questions": 10, "time_min": 10},
                {"key": "verbal",     "label": "Verbal Ability",     "questions": 10, "time_min": 10},
                {"key": "reasoning",  "label": "Reasoning Ability",  "questions": 10, "time_min": 10},
            ],
        },
        "rules": [
            "Cannot go back to previous questions",
            "Section timer locks when time expires",
            "No negative marking",
            "Attempt every question — wrong = 0, blank = 0",
        ],
        "bands": {
            "ninja":   {"min_pct": 40, "label": "Ninja",   "ctc": "Rs.3.36 LPA"},
            "digital": {"min_pct": 65, "label": "Digital", "ctc": "Rs.7 LPA (approx)"},
            "prime":   {"min_pct": 80, "label": "Prime",   "ctc": "Rs.9-11.5 LPA"},
        },
    },
    "infosys": {
        "name": "Infosys InfyTQ",
        "full_name": "Infosys System Engineer Online Assessment",
        "total_time_min": 90,
        "tracks": ["foundation"],
        "sections": {
            "foundation": [
                {"key": "reasoning",    "label": "Reasoning Ability",      "questions": 10, "time_min": 25},
                {"key": "quantitative", "label": "Quantitative Ability",   "questions": 10, "time_min": 25},
                {"key": "verbal",       "label": "Verbal Ability",         "questions": 10, "time_min": 20},
                {"key": "pseudocode",   "label": "Pseudocode",             "questions": 5,  "time_min": 20},
            ],
        },
        "rules": [
            "Each section has individual cutoffs — must clear all sections",
            "Cannot go back to previous questions",
            "No negative marking",
            "Pseudocode section tests programming logic without actual coding",
        ],
        "bands": {
            "se":  {"min_pct": 50, "label": "System Engineer (SE)",          "ctc": "Rs.3.6 LPA"},
            "sp":  {"min_pct": 75, "label": "Specialist Programmer (SP)",    "ctc": "Rs.8-9 LPA"},
            "dse": {"min_pct": 85, "label": "Digital Specialist Engineer",   "ctc": "Rs.9 LPA (approx)"},
        },
    },
    "wipro": {
        "name": "Wipro NLTH",
        "full_name": "Wipro National Level Talent Hunt",
        "total_time_min": 60,
        "tracks": ["foundation"],
        "sections": {
            "foundation": [
                {"key": "aptitude", "label": "Aptitude",         "questions": 10, "time_min": 20},
                {"key": "verbal",   "label": "Verbal Ability",   "questions": 10, "time_min": 20},
            ],
        },
        "rules": [
            "Cannot go back to previous questions",
            "Written communication section not included in this practice (requires essay input)",
            "No negative marking",
            "Game-based assessment not included — separate platform",
        ],
        "bands": {
            "project_engineer": {"min_pct": 50, "label": "Project Engineer", "ctc": "Rs.3.5 LPA"},
            "turbo":            {"min_pct": 75, "label": "Wipro Turbo",      "ctc": "Rs.6.5 LPA (approx)"},
        },
    },
    "cognizant": {
        "name": "Cognizant GenC",
        "full_name": "Cognizant Online Assessment",
        "total_time_min": 120,
        "tracks": ["foundation"],
        "sections": {
            "foundation": [
                {"key": "quantitative", "label": "Quantitative Aptitude", "questions": 10, "time_min": 16},
                {"key": "reasoning",    "label": "Reasoning Ability",     "questions": 10, "time_min": 16},
                {"key": "verbal",       "label": "Verbal Ability",        "questions": 10, "time_min": 25},
            ],
        },
        "rules": [
            "Cannot go back to previous questions",
            "No negative marking",
            "Personality test not included in this practice",
            "GenC Next and Elevate tracks have additional coding round",
        ],
        "bands": {
            "genc":         {"min_pct": 50, "label": "GenC",         "ctc": "Rs.4 LPA"},
            "genc_next":    {"min_pct": 70, "label": "GenC Next",    "ctc": "Rs.7-8 LPA"},
            "genc_elevate": {"min_pct": 85, "label": "GenC Elevate", "ctc": "Rs.9 LPA (approx)"},
        },
    },
}

# ─── Schemas ──────────────────────────────────────────────────────────────────

class StartOARequest(BaseModel):
    company: str
    track: str = "foundation"

class SubmitOARequest(BaseModel):
    attempt_id: int
    answers: list[dict]   # [{question_id, selected_option, time_sec, section}]
    time_taken_sec: int

# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/config/{company}")
def get_oa_config(company: str):
    """Return OA config for a company — used to render the intro page."""
    config = OA_CONFIGS.get(company)
    if not config:
        raise HTTPException(404, f"No OA config for company: {company}")
    return config


@router.get("/companies")
def list_oa_companies():
    """List all companies with OA practice available."""
    return {
        "companies": [
            {
                "slug": k,
                "name": v["name"],
                "full_name": v["full_name"],
                "total_time_min": v["total_time_min"],
            }
            for k, v in OA_CONFIGS.items()
        ]
    }


@router.post("/start")
@rate_limit(max_requests=10, window_seconds=3600)
def start_oa(
    request: Request,
    payload: StartOARequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Start an OA attempt — requires auth."""
    config = OA_CONFIGS.get(payload.company)
    if not config:
        raise HTTPException(404, "Company OA not found")

    track_sections = config["sections"].get(payload.track)
    if not track_sections:
        raise HTTPException(400, "Invalid track")

    # Fetch questions for each section
    questions_by_section = {}
    for section_config in track_sections:
        section_key = section_config["key"]
        limit = section_config["questions"]

        rows = db.execute(
            text("""
                SELECT id, question_text, options, section, topic, time_limit_sec
                FROM oa_questions
                WHERE company = :company
                  AND section = :section
                  AND is_active = TRUE
                ORDER BY RANDOM()
                LIMIT :limit
            """),
            {"company": payload.company, "section": section_key, "limit": limit},
        ).mappings().all()

        questions_by_section[section_key] = [
            {
                "id": r["id"],
                "question_text": r["question_text"],
                "options": r["options"] if isinstance(r["options"], list)
                           else json.loads(r["options"]),
                "section": r["section"],
                "topic": r["topic"],
                "time_limit_sec": r["time_limit_sec"] or 90,
            }
            for r in rows
        ]

        if len(questions_by_section[section_key]) < limit:
            # Not enough questions — use what we have, don't fail
            pass

    # Create attempt
    result = db.execute(
        text("""
            INSERT INTO oa_attempts (user_id, company, track, status)
            VALUES (:uid, :company, :track, 'in_progress')
            RETURNING id
        """),
        {
            "uid": current_user.id,
            "company": payload.company,
            "track": payload.track,
        },
    ).fetchone()
    db.commit()

    return {
        "attempt_id": result[0],
        "company": payload.company,
        "track": payload.track,
        "config": config,
        "questions": questions_by_section,
        "section_order": [s["key"] for s in track_sections],
        "section_configs": track_sections,
    }


@router.post("/submit")
@rate_limit(max_requests=30, window_seconds=3600)
def submit_oa(
    request: Request,
    payload: SubmitOARequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Submit OA answers and get results."""
    attempt = db.execute(
        text("""
            SELECT id, company, track, status FROM oa_attempts
            WHERE id = :id AND user_id = :uid
        """),
        {"id": payload.attempt_id, "uid": current_user.id},
    ).fetchone()

    if not attempt:
        raise HTTPException(404, "Attempt not found")
    if attempt[3] == "completed":
        raise HTTPException(400, "Already submitted")

    company = attempt[1]
    config = OA_CONFIGS.get(company, {})

    # Score each answer
    question_ids = [a["question_id"] for a in payload.answers]
    correct_map = {}

    if question_ids:
        rows = db.execute(
            text("""
                SELECT id, correct_option, section
                FROM oa_questions
                WHERE id = ANY(:ids)
            """),
            {"ids": question_ids},
        ).mappings().all()
        correct_map = {r["id"]: (r["correct_option"], r["section"]) for r in rows}

    section_scores: dict = {}
    enriched = []

    for ans in payload.answers:
        qid = ans["question_id"]
        selected = ans.get("selected_option")
        if qid not in correct_map:
            continue
        correct_opt, section = correct_map[qid]
        is_correct = selected == correct_opt

        if section not in section_scores:
            section_scores[section] = {"correct": 0, "total": 0}
        section_scores[section]["total"] += 1
        if is_correct:
            section_scores[section]["correct"] += 1

        enriched.append({**ans, "correct": correct_opt, "is_correct": is_correct})

    # Convert to percentages
    pct_scores = {
        s: round(d["correct"] / d["total"] * 100) if d["total"] > 0 else 0
        for s, d in section_scores.items()
    }

    # Overall score
    total_score = round(sum(pct_scores.values()) / len(pct_scores)) if pct_scores else 0

    # Band prediction (TCS-specific)
    band_prediction = "not_qualified"
    bands = config.get("bands", {})
    for band_key in ["prime", "digital", "ninja"]:
        band = bands.get(band_key)
        if band and total_score >= band["min_pct"]:
            band_prediction = band_key
            break

    # Save results
    db.execute(
        text("""
            UPDATE oa_attempts SET
                answers        = :answers,
                section_scores = :sections,
                total_score    = :total,
                band_prediction = :band,
                time_taken_sec = :time_taken,
                status         = 'completed',
                completed_at   = NOW()
            WHERE id = :id
        """),
        {
            "answers":    json.dumps(enriched),
            "sections":   json.dumps(pct_scores),
            "total":      total_score,
            "band":       band_prediction,
            "time_taken": payload.time_taken_sec,
            "id":         payload.attempt_id,
        },
    )
    db.commit()

    return {
        "attempt_id": payload.attempt_id,
        "total_score": total_score,
        "section_scores": pct_scores,
        "band_prediction": band_prediction,
        "band_info": bands.get(band_prediction),
        "time_taken_sec": payload.time_taken_sec,
        "enriched_answers": enriched,
    }


@router.get("/results/{attempt_id}")
def get_oa_results(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get full OA results."""
    row = db.execute(
        text("""
            SELECT * FROM oa_attempts
            WHERE id = :id AND user_id = :uid AND status = 'completed'
        """),
        {"id": attempt_id, "uid": current_user.id},
    ).mappings().first()

    if not row:
        raise HTTPException(404, "Results not found")

    data = dict(row)
    company = data.get("company", "tcs")
    config = OA_CONFIGS.get(company, {})
    band_prediction = data.get("band_prediction", "not_qualified")

    section_scores = data.get("section_scores") or {}
    if isinstance(section_scores, str):
        section_scores = json.loads(section_scores)

    return {
        "attempt_id": attempt_id,
        "company": company,
        "total_score": round(data.get("total_score") or 0),
        "section_scores": section_scores,
        "band_prediction": band_prediction,
        "band_info": config.get("bands", {}).get(band_prediction),
        "all_bands": config.get("bands", {}),
        "time_taken_sec": data.get("time_taken_sec"),
        "completed_at": str(data.get("completed_at", "")),
    }


@router.get("/history")
def get_oa_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get user's OA attempt history."""
    rows = db.execute(
        text("""
            SELECT id, company, track, total_score, band_prediction,
                   time_taken_sec, status, started_at, completed_at
            FROM oa_attempts
            WHERE user_id = :uid
            ORDER BY started_at DESC
            LIMIT 20
        """),
        {"uid": current_user.id},
    ).mappings().all()

    return {"attempts": [dict(r) for r in rows]}