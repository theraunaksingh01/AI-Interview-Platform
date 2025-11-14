# backend/api/interview.py
from __future__ import annotations

import json
from uuid import UUID
from typing import Optional, Any, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text, bindparam
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import JSONB

from api.deps import get_db, get_current_user
from core.config import settings
from core.s3_client import get_s3_client
from tasks.report_pdf import generate_pdf
from tasks.score_interview import score_interview
from tasks.resume_tasks import extract_resume_text
from tasks.question_tasks import generate_questions_ai

router = APIRouter(prefix="/interview", tags=["interview"])


# ---------------------------
# Start + Seed + Questions
# ---------------------------

@router.post("/start")
def start_interview(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    Creates a new interview row and returns its UUID.
    Assumes interviews.user_id is INT; adjust if your schema uses UUID user ids.
    """
    try:
        res = db.execute(
            text("""
                INSERT INTO interviews (user_id, status)
                VALUES (:user_id, 'recording')
                RETURNING id
            """),
            {"user_id": int(user.id)},
        )
        interview_id = res.scalar_one()
        db.commit()
        return {"interview_id": str(interview_id)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"/interview/start failed: {e}")


@router.post("/seed/{interview_id}")
def seed_questions(interview_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    exists = db.execute(text("SELECT 1 FROM interviews WHERE id = :id"), {"id": str(interview_id)}).scalar()
    if not exists:
        raise HTTPException(status_code=404, detail="Interview not found")

    already = db.execute(
        text("SELECT COUNT(*) FROM interview_questions WHERE interview_id=:id"),
        {"id": str(interview_id)}
    ).scalar() or 0

    if already > 0:
        return {"ok": True, "seeded": False, "total": int(already)}  # no-op

    db.execute(
        text("""
            INSERT INTO interview_questions (interview_id, question_text, type, time_limit_seconds)
            VALUES 
              (:id, 'Explain DSA in simple words', 'voice', 120),
              (:id, 'Write code for Tower of Hanoi', 'code', 300)
        """),
        {"id": str(interview_id)},
    )
    db.commit()
    return {"ok": True, "seeded": True}


@router.get("/questions/{interview_id}")
def get_questions(interview_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = db.execute(
        text("""
            SELECT id, question_text, type, time_limit_seconds
            FROM interview_questions
            WHERE interview_id = :id
            ORDER BY id ASC
        """),
        {"id": str(interview_id)}
    ).mappings().all()
    return [dict(r) for r in rows]


# ---------------------------
# Phase 4B: AI question generation
# ---------------------------

# --- add field ---
class GenerateIn(BaseModel):
    interview_id: UUID
    count: int | None = None
    extract_resume: bool = True
    replace: bool = False  # NEW

@router.post("/generate")
def generate_questions(payload: GenerateIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    row = db.execute(text("""
        SELECT id, role_id, resume_id
        FROM interviews
        WHERE id = :iid
    """), {"iid": str(payload.interview_id)}).mappings().first()
    if not row: raise HTTPException(status_code=404, detail="interview not found")
    if not row["role_id"]: raise HTTPException(status_code=400, detail="role_id missing on interview")
    if not row["resume_id"]: raise HTTPException(status_code=400, detail="resume_id missing on interview")

    # NEW: optional replacement
    if payload.replace:
        db.execute(text("DELETE FROM interview_questions WHERE interview_id = :iid"), {"iid": str(payload.interview_id)})
        db.commit()

    if payload.extract_resume:
        try:
            extract_resume_text.delay(int(row["resume_id"]))
        except Exception:
            extract_resume_text.delay(row["resume_id"])

    task = generate_questions_ai.delay(str(payload.interview_id), payload.count)
    return {"queued": True, "task_id": task.id}


# ---------------------------
# Record answer (video/code)
# ---------------------------

class RecordAnswer(BaseModel):
    question_id: int
    upload_id: Optional[int] = None          # for voice answers
    code_answer: Optional[str] = None        # for code answers
    # optional grading payload from /code/grade:
    code_output: Optional[str] = None
    test_results: Optional[dict[str, Any]] = None

@router.post("/answer")
def record_answer(payload: RecordAnswer, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # Ensure question exists
    qid = db.execute(
        text("SELECT id FROM interview_questions WHERE id = :qid"),
        {"qid": payload.question_id}
    ).scalar()
    if not qid:
        raise HTTPException(status_code=404, detail="Question not found")

    # Insert answer with optional grading fields
    db.execute(
        text("""
          INSERT INTO interview_answers
            (interview_question_id, upload_id, code_answer, code_output, test_results)
          VALUES
            (:qid, :uid, :code, :out, CAST(:tests AS jsonb))
        """),
        {
            "qid": payload.question_id,
            "uid": payload.upload_id,
            "code": payload.code_answer,
            "out": payload.code_output,
            "tests": json.dumps(payload.test_results) if payload.test_results is not None else None,
        },
    )
    db.commit()
    return {"ok": True}


# ---------------------------
# Persist anti-cheat flags
# ---------------------------

class FlagsIn(BaseModel):
    question_id: int
    flags: List[str]

@router.post("/flags")
def save_flags(payload: FlagsIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # 1) detect FK column
    qcol = db.execute(text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'interview_answers'
          AND column_name IN ('interview_question_id','question_id')
        LIMIT 1
    """)).scalar()
    if not qcol:
        raise HTTPException(500, "interview_answers missing FK column")

    # 2) detect ordering column
    has_created_at = db.execute(text("""
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'interview_answers' AND column_name = 'created_at'
        LIMIT 1
    """)).scalar() is not None
    order_clause = "created_at DESC NULLS LAST" if has_created_at else "id DESC"

    # 3) latest answer id
    answer_id = db.execute(
        text(f"""
            SELECT id FROM interview_answers
            WHERE {qcol} = :qid
            ORDER BY {order_clause}
            LIMIT 1
        """),
        {"qid": payload.question_id}
    ).scalar()
    if not answer_id:
        raise HTTPException(404, "No answer found to attach flags (save an answer first)")

    # 4) read current flags
    cur = db.execute(text("SELECT cheat_flags FROM interview_answers WHERE id = :aid"), {"aid": answer_id}).scalar()
    try:
        cur_list = json.loads(cur) if isinstance(cur, str) else (cur or [])
    except Exception:
        cur_list = []
    if not isinstance(cur_list, list):
        cur_list = []

    # 5) merge & dedupe
    merged = list(dict.fromkeys([*cur_list, *payload.flags]))

    # 6) overwrite with bound JSONB (NO ::jsonb, NO ||)
    upd = text("UPDATE interview_answers SET cheat_flags = :merged WHERE id = :aid RETURNING id")
    upd = upd.bindparams(bindparam("merged", type_=JSONB))
    updated_id = db.execute(upd, {"merged": merged, "aid": answer_id}).scalar()
    db.commit()

    if not updated_id:
        raise HTTPException(500, "Failed to update cheat_flags")

    return {"ok": True, "answer_id": int(updated_id), "cheat_flags": merged}


# ---------------------------
# Progress & Reporting
# ---------------------------

class ProgressOut(BaseModel):
    total: int
    answered: int
    percent: int

@router.get("/progress/{interview_id}", response_model=ProgressOut)
def interview_progress(interview_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # total questions
    total = db.execute(
        text("SELECT COUNT(*) FROM interview_questions WHERE interview_id = :iid"),
        {"iid": str(interview_id)}
    ).scalar() or 0

    # answered questions (count a question if latest answer has either upload_id (voice) OR code_answer)
    answered = db.execute(
        text("""
        WITH latest AS (
          SELECT q.id AS qid,
                 (SELECT a1.id
                  FROM interview_answers a1
                  WHERE a1.interview_question_id = q.id
                  ORDER BY a1.created_at DESC NULLS LAST, a1.id DESC
                  LIMIT 1) AS aid
          FROM interview_questions q
          WHERE q.interview_id = :iid
        )
        SELECT COUNT(*)
        FROM latest L
        JOIN interview_answers A ON A.id = L.aid
        WHERE (A.upload_id IS NOT NULL) OR (A.code_answer IS NOT NULL AND length(A.code_answer) > 0)
        """),
        {"iid": str(interview_id)}
    ).scalar() or 0

    pct = int(round(100 * (answered / total), 0)) if total else 0
    return {"total": total, "answered": answered, "percent": pct}


@router.get("/report/{interview_id}")
def report(interview_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = db.execute(
        text("""
            SELECT
              q.id AS question_id, q.type, q.question_text, q.time_limit_seconds,
              a.id AS answer_id, a.upload_id, a.code_answer, a.code_output,
              a.test_results, a.cheat_flags, a.transcript, a.ai_feedback, a.created_at
            FROM interview_questions q
            LEFT JOIN LATERAL (
              SELECT * FROM interview_answers a2
              WHERE a2.interview_question_id = q.id
              ORDER BY a2.created_at DESC NULLS LAST
              LIMIT 1
            ) a ON TRUE
            WHERE q.interview_id = :id
            ORDER BY q.id ASC
        """),
        {"id": str(interview_id)}
    ).mappings().all()
    return [dict(r) for r in rows]


@router.post("/score/{interview_id}")
def score_now(interview_id: UUID, user=Depends(get_current_user)):
    """Queue AI scoring for this interview (LLM + aggregation)."""
    task = score_interview.delay(str(interview_id))
    return {"queued": True, "task_id": task.id}


@router.post("/report/{interview_id}/pdf")
def pdf_now(interview_id: UUID, user=Depends(get_current_user)):
    """Queue PDF generation. Stores PDF to S3/MinIO as reports/{id}.pdf"""
    task = generate_pdf.delay(str(interview_id))
    return {"queued": True, "task_id": task.id}


@router.get("/report/{interview_id}/pdf")
def pdf_info(interview_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Return PDF location (and a presigned URL if possible)."""
    key = db.execute(text("SELECT pdf_key FROM interviews WHERE id = :i"), {"i": str(interview_id)}).scalar()
    if not key:
        raise HTTPException(status_code=404, detail="PDF not ready")
    bucket = getattr(settings, "S3_BUCKET", getattr(settings, "s3_bucket", None))
    if not bucket:
        raise HTTPException(status_code=500, detail="Bucket not configured")

    # Try to presign (works for MinIO/S3 if creds are set)
    try:
        s3 = get_s3_client()
        expires = int(getattr(settings, "PRESIGNED_URL_EXPIRES", 900))
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires,
        )
    except Exception:
        url = None

    return {"bucket": bucket, "key": key, "presigned_url": url}
