# backend/api/resume_prep.py
"""
Resume / Project Discussion Prep — Max tier.

Student uploads resume (PDF or pasted text). Claude extracts
projects/skills/experience, generates personalized interview
questions, then reuses the existing mock_sessions + interviews +
interview_questions pipeline so the rest of the platform
(WebSocket flow, scoring, coaching report) works unchanged.

POST /api/resume-prep/extract   — parse resume, return structured data
POST /api/resume-prep/start     — create session + generate questions
GET  /api/resume-prep/consistency/{session_id} — consistency check for report
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime
from io import BytesIO
from typing import Any, Optional
from uuid import uuid4

import anthropic
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_current_user
from db.session import SessionLocal

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resume-prep", tags=["resume-prep"])

RESUME_PREP_PLANS = {"max"}

# ─── Schemas ──────────────────────────────────────────────────────────────────

class ExtractTextRequest(BaseModel):
    raw_text: str


class ExtractedProject(BaseModel):
    name: str
    tech_stack: list[str] = []
    description: str = ""


class ExtractedResume(BaseModel):
    projects: list[ExtractedProject] = []
    skills: list[str] = []
    experience: list[str] = []
    education: list[str] = []
    raw_text: str = ""


class StartRequest(BaseModel):
    role_target: str
    resume_data: ExtractedResume
    duration_mins: Optional[int] = 30


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_user_plan(db: Session, user_id: int) -> str:
    row = db.execute(
        text("SELECT plan FROM users WHERE id = :uid"), {"uid": user_id}
    ).scalar()
    return (row or "free").lower()


def _claude_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    return anthropic.Anthropic(api_key=api_key)


def _strip_json_fence(raw: str) -> str:
    clean = raw.strip()
    clean = re.sub(r"^```[a-z]*\n?", "", clean)
    clean = re.sub(r"\n?```$", "", clean)
    return clean.strip()


def _extract_pdf_text(file_bytes: bytes) -> str:
    """Extract raw text from a PDF using pdfplumber."""
    import pdfplumber
    text_parts = []
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
    return "\n".join(text_parts)


def _parse_resume_with_claude(raw_text: str) -> ExtractedResume:
    """Use Claude to structure raw resume text into projects/skills/experience."""
    client = _claude_client()

    prompt = f"""Extract structured information from this resume text.

Resume text:
---
{raw_text[:4000]}
---

Return ONLY valid JSON, no markdown, no preamble, in this exact format:
{{
  "projects": [
    {{"name": "Project Name", "tech_stack": ["tech1", "tech2"], "description": "one sentence description"}}
  ],
  "skills": ["skill1", "skill2"],
  "experience": ["Company Name - Role - brief description"],
  "education": ["Degree, College, Year"]
}}

Extract every project mentioned, even small ones. Be accurate — only include what's actually written, don't infer beyond what's stated."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = ""
    for block in getattr(response, "content", []):
        if getattr(block, "type", "") == "text":
            raw += getattr(block, "text", "")

    parsed = json.loads(_strip_json_fence(raw))

    return ExtractedResume(
        projects=[ExtractedProject(**p) for p in parsed.get("projects", [])],
        skills=parsed.get("skills", []),
        experience=parsed.get("experience", []),
        education=parsed.get("education", []),
        raw_text=raw_text[:6000],
    )


def _generate_resume_questions(resume: ExtractedResume, role_target: str) -> list[dict]:
    """
    Generate personalized interview questions based on resume data.
    Returns list of {question_text, type, topic, targets_project}.
    """
    client = _claude_client()

    projects_summary = "\n".join(
        f"- {p.name}: {', '.join(p.tech_stack)} — {p.description}"
        for p in resume.projects
    ) or "No specific projects listed."

    skills_summary = ", ".join(resume.skills) or "No specific skills listed."
    experience_summary = "\n".join(resume.experience) or "No work experience listed."

    prompt = f"""You are a senior technical interviewer preparing questions for a candidate applying for a {role_target} role.

Their resume contains:

PROJECTS:
{projects_summary}

SKILLS:
{skills_summary}

EXPERIENCE:
{experience_summary}

Generate exactly 8 interview questions, in this order:

1. "Tell me about yourself" — standard opener, but phrase it naturally
2-3. Deep technical questions on their MOST SUBSTANTIAL project — ask about architecture, a specific technical decision, or a challenge they likely faced. Reference the project by name.
4-5. Deep technical questions on their SECOND project (if exists) or probe a specific skill they listed — ask them to justify why they chose a technology, or explain it precisely (e.g. "You listed Redis — what did you use it for specifically and how does cache invalidation work in your implementation?")
6. A question testing for resume inflation — if they used words like "led", "built", "designed", "architected", ask them to be specific about their individual contribution vs team effort
7. A behavioral question connecting their experience to the target role
8. "Why are you interested in this role/company" type closer

Return ONLY valid JSON, no markdown:
{{
  "questions": [
    {{"question_text": "...", "type": "voice", "topic": "introduction|project|technical|behavioral", "targets_project": "project name or null"}}
  ]
}}

Make every question specific to THEIR resume — never generic. Reference actual project names and technologies."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = ""
    for block in getattr(response, "content", []):
        if getattr(block, "type", "") == "text":
            raw += getattr(block, "text", "")

    parsed = json.loads(_strip_json_fence(raw))
    questions = parsed.get("questions", [])

    if not questions:
        raise ValueError("No questions generated")

    return questions


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/extract")
async def extract_resume(
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """
    Extract structured resume data from an uploaded PDF.
    For pasted text, use /extract-text instead.
    """
    plan = _get_user_plan(db, current_user.id)
    if plan not in RESUME_PREP_PLANS:
        raise HTTPException(status_code=403, detail="resume_prep_requires_max")

    if not file:
        raise HTTPException(status_code=400, detail="no_file_provided")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="only_pdf_supported")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="file_too_large")

    try:
        raw_text = _extract_pdf_text(contents)
    except Exception as e:
        log.warning("[RESUME_PREP] PDF extraction failed: %s", e)
        raise HTTPException(status_code=400, detail="pdf_extraction_failed")

    if not raw_text or len(raw_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="resume_text_too_short")

    try:
        extracted = _parse_resume_with_claude(raw_text)
    except Exception as e:
        log.error("[RESUME_PREP] Claude parsing failed: %s", e)
        raise HTTPException(status_code=500, detail="resume_parsing_failed")

    return extracted.model_dump()


@router.post("/extract-text")
def extract_resume_text(
    payload: ExtractTextRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Extract structured resume data from pasted text."""
    plan = _get_user_plan(db, current_user.id)
    if plan not in RESUME_PREP_PLANS:
        raise HTTPException(status_code=403, detail="resume_prep_requires_max")

    if not payload.raw_text or len(payload.raw_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="text_too_short")

    try:
        extracted = _parse_resume_with_claude(payload.raw_text)
    except Exception as e:
        log.error("[RESUME_PREP] Claude parsing failed: %s", e)
        raise HTTPException(status_code=500, detail="resume_parsing_failed")

    return extracted.model_dump()


@router.post("/start")
def start_resume_session(
    payload: StartRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """
    Create a mock_session + interview + interview_questions using
    resume-personalized questions. Reuses existing interview pipeline.
    """
    plan = _get_user_plan(db, current_user.id)
    if plan not in RESUME_PREP_PLANS:
        raise HTTPException(status_code=403, detail="resume_prep_requires_max")

    try:
        questions = _generate_resume_questions(payload.resume_data, payload.role_target)
    except Exception as e:
        log.error("[RESUME_PREP] Question generation failed: %s", e)
        raise HTTPException(status_code=500, detail="question_generation_failed")

    # Create mock_session
    mock_row = db.execute(
        text("""
            INSERT INTO mock_sessions (
                user_id, role_target, seniority, company_type,
                focus_area, resume_uploaded, duration_mins,
                status, session_type, started_at
            )
            VALUES (
                :uid, :role, 'intermediate', NULL,
                'resume_prep', TRUE, :duration,
                'in_progress', 'resume_prep', :started_at
            )
            RETURNING id
        """),
        {
            "uid": current_user.id,
            "role": payload.role_target,
            "duration": payload.duration_mins or 30,
            "started_at": datetime.utcnow(),
        },
    ).mappings().first()

    mock_session_id = mock_row["id"]

    # Create interview
    interview_row = db.execute(
        text("""
            INSERT INTO interviews (mock_session_id, status, created_at)
            VALUES (:sid, 'in_progress', now())
            RETURNING id
        """),
        {"sid": str(mock_session_id)},
    ).mappings().first()

    interview_id = interview_row["id"]

    # Insert questions
    for i, q in enumerate(questions):
        db.execute(
            text("""
                INSERT INTO interview_questions
                    (interview_id, question_text, type, topic, source, position)
                VALUES
                    (:iid, :qt, :type, :topic, 'resume_prep', :pos)
            """),
            {
                "iid": str(interview_id),
                "qt": q.get("question_text", ""),
                "type": q.get("type", "voice"),
                "topic": q.get("topic", "project"),
                "pos": i,
            },
        )

    # Store resume data for later consistency check
    db.execute(
        text("""
            INSERT INTO resume_prep_sessions
                (mock_session_id, user_id, resume_data, role_target)
            VALUES
                (:sid, :uid, CAST(:data AS jsonb), :role)
        """),
        {
            "sid": str(mock_session_id),
            "uid": current_user.id,
            "data": json.dumps(payload.resume_data.model_dump()),
            "role": payload.role_target,
        },
    )

    db.commit()

    return {
        "session_id": str(mock_session_id),
        "interview_id": str(interview_id),
        "total_questions": len(questions),
    }


@router.get("/consistency/{session_id}")
def check_consistency(
    session_id: str,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """
    Cross-check the student's spoken answers against their resume claims.
    Called when generating the coaching report for resume_prep sessions.
    """
    # Load resume data
    resume_row = db.execute(
        text("""
            SELECT resume_data FROM resume_prep_sessions
            WHERE mock_session_id = CAST(:sid AS uuid)
        """),
        {"sid": session_id},
    ).mappings().first()

    if not resume_row:
        return {"has_data": False}

    resume_data = resume_row["resume_data"]
    if isinstance(resume_data, str):
        resume_data = json.loads(resume_data)

    # Load all transcripts for this session
    rows = db.execute(
        text("""
            SELECT iq.question_text, iq.topic, ia.transcript
            FROM interviews i
            JOIN interview_questions iq ON iq.interview_id = i.id
            LEFT JOIN interview_answers ia ON ia.interview_question_id = iq.id
            WHERE i.mock_session_id = CAST(:sid AS uuid)
            ORDER BY iq.position ASC
        """),
        {"sid": session_id},
    ).mappings().all()

    qa_pairs = "\n\n".join(
        f"Q: {r['question_text']}\nA: {(r['transcript'] or '')[:400]}"
        for r in rows if r["transcript"]
    )

    if not qa_pairs:
        return {"has_data": False}

    try:
        client = _claude_client()
        projects_text = "\n".join(
            f"- {p.get('name')}: {', '.join(p.get('tech_stack', []))} — {p.get('description', '')}"
            for p in resume_data.get("projects", [])
        )

        prompt = f"""Compare what this candidate's resume claims against what they actually said in their interview.

RESUME CLAIMS:
{projects_text}
Skills: {', '.join(resume_data.get('skills', []))}

INTERVIEW TRANSCRIPT:
{qa_pairs[:3000]}

Evaluate consistency. Return ONLY valid JSON, no markdown:
{{
  "consistency_score": <0-100>,
  "summary": "<2-3 sentence honest assessment>",
  "gaps": ["<short gap, max 15 words>", "<short gap, max 15 words>", "<short gap, max 15 words>"]
}}

List at most 3 gaps, each under 15 words. Be specific but concise. If they listed a technology but couldn't explain it when asked, that's a gap. If their spoken explanation matched or exceeded what's on the resume, score high."""

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = ""
        for block in getattr(response, "content", []):
            if getattr(block, "type", "") == "text":
                raw += getattr(block, "text", "")

        parsed = json.loads(_strip_json_fence(raw))

        return {
            "has_data": True,
            "consistency_score": parsed.get("consistency_score", 70),
            "summary": parsed.get("summary", ""),
            "gaps": parsed.get("gaps", []),
        }

    except Exception as e:
        import traceback
        log.error("[RESUME_PREP] Consistency check failed: %s", e)
        log.error(traceback.format_exc())
        return {"has_data": False}