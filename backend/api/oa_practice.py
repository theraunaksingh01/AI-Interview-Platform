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
from api.rate_limit import oa_start_rate_limit_dep, oa_submit_rate_limit_dep
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
        "accenture": {
        "name": "Accenture Assessment",
        "full_name": "Accenture Cognitive and Technical Assessment",
        "total_time_min": 90,
        "tracks": ["foundation"],
        "sections": {
            "foundation": [
                {"key": "verbal",     "label": "Verbal Ability",     "questions": 30, "time_min": 25},
                {"key": "numerical",  "label": "Numerical Ability",  "questions": 30, "time_min": 25},
                {"key": "reasoning",  "label": "Reasoning Ability",  "questions": 25, "time_min": 20},
                {"key": "technical",  "label": "Technical",          "questions": 25, "time_min": 20},
            ],
        },
        "rules": [
            "Sectional cutoffs apply - must clear each section individually",
            "Cannot go back to previous questions",
            "No negative marking",
            "Technical section covers pseudocode, networking, and cloud basics",
        ],
        "bands": {
            "pass":     {"min_pct": 50, "label": "Cleared",          "ctc": "Rs.4.5-7 LPA"},
            "strong":   {"min_pct": 70, "label": "Strong Performer", "ctc": "Rs.7 LPA (approx)"},
        },
    },
    "hcltech": {
        "name": "HCLTech Assessment",
        "full_name": "HCLTech Online Aptitude and Technical Test",
        "total_time_min": 60,
        "tracks": ["foundation"],
        "sections": {
            "foundation": [
                {"key": "numerical",  "label": "Numerical Ability",   "questions": 35, "time_min": 15},
                {"key": "reasoning",  "label": "Logical Reasoning",   "questions": 35, "time_min": 15},
                {"key": "verbal",     "label": "Verbal Ability",      "questions": 30, "time_min": 15},
                {"key": "technical",  "label": "Technical",           "questions": 30, "time_min": 15},
            ],
        },
        "rules": [
            "Sectional cutoffs apply",
            "No negative marking",
            "Cannot go back to previous questions",
            "Technical section covers OOPS, DBMS, Networking, and OS basics",
        ],
        "bands": {
            "pass":   {"min_pct": 45, "label": "Cleared",          "ctc": "Rs.3.5-4.5 LPA"},
            "strong": {"min_pct": 65, "label": "Strong Performer", "ctc": "Rs.4.5-6 LPA"},
        },
    },
    "tech mahindra": {
        "name": "Tech Mahindra Assessment",
        "full_name": "Tech Mahindra National Qualifying Test",
        "total_time_min": 90,
        "tracks": ["foundation"],
        "sections": {
            "foundation": [
                {"key": "numerical",  "label": "Numerical Ability",  "questions": 35, "time_min": 25},
                {"key": "reasoning",  "label": "Logical Reasoning",  "questions": 35, "time_min": 25},
                {"key": "verbal",     "label": "Verbal Ability",     "questions": 30, "time_min": 20},
                {"key": "technical",  "label": "Technical",          "questions": 30, "time_min": 20},
            ],
        },
        "rules": [
            "No negative marking",
            "Cannot go back to previous questions",
            "Section timer locks when time expires",
            "Technical section covers programming fundamentals, OOPS, DBMS, and networking",
        ],
        "bands": {
            "pass":   {"min_pct": 45, "label": "Cleared",          "ctc": "Rs.3.25-4 LPA"},
            "strong": {"min_pct": 65, "label": "Strong Performer", "ctc": "Rs.4-5 LPA"},
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
    ended_early_reason: Optional[str] = None

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
def start_oa(
    request: Request,
    payload: StartOARequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _rl=Depends(oa_start_rate_limit_dep),
):
    """Start an OA attempt — requires auth."""
    config = OA_CONFIGS.get(payload.company.replace("-", " "))
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

def submit_oa(
    request: Request,
    payload: SubmitOARequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _rl=Depends(oa_submit_rate_limit_dep),
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
                completed_at   = NOW(),
                ended_early_reason = :ended_early
            WHERE id = :id
        """),
        {
            "answers":    json.dumps(enriched),
            "sections":   json.dumps(pct_scores),
            "total":      total_score,
            "band":       band_prediction,
            "time_taken": payload.time_taken_sec,
            "id":         payload.attempt_id,
            "ended_early": payload.ended_early_reason,
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
        "ended_early_reason": payload.ended_early_reason,
    }


@router.get("/results/{attempt_id}/public")
def get_public_oa_results(
    attempt_id: int,
    db: Session = Depends(get_db),
):
    """
    Minimal, unauthenticated OA result data — used only for generating
    OG share images (opengraph-image.tsx). No auth required.
 
    Returns ONLY score/company/band — no name, email, or other PII,
    since this endpoint has no auth check.
    """
    row = db.execute(
        text("""
            SELECT company, total_score, band_prediction
            FROM oa_attempts
            WHERE id = :id AND status = 'completed'
        """),
        {"id": attempt_id},
    ).mappings().first()
 
    if not row:
        raise HTTPException(404, "Results not found")
 
    company = row["company"] or "tcs"
    config = OA_CONFIGS.get(company, {})
    band_prediction = row["band_prediction"] or "not_qualified"
 
    return {
        "company": company,
        "total_score": round(row["total_score"] or 0),
        "band_prediction": band_prediction,
        "band_info": config.get("bands", {}).get(band_prediction),
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
        "ended_early_reason": data.get("ended_early_reason"),
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