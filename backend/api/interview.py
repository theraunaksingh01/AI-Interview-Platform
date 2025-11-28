from __future__ import annotations

import json
from uuid import UUID
from typing import Optional, Any, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_db, get_current_user
from core.config import settings
from core.s3_client import get_s3_client

# tasks
from tasks.report_pdf import generate_pdf
from tasks.score_interview import score_interview
from tasks.resume_tasks import extract_resume_text
from tasks.question_tasks import generate_questions_ai

# celery app (to inspect task status)
from celery_app import app as celery_app
from celery.result import AsyncResult

import os
import httpx

router = APIRouter(prefix="/interview", tags=["interview"])


# ---------------------------
# Start + Seed + Questions
# ---------------------------

@router.post("/start")
def start_interview(db: Session = Depends(get_db), user=Depends(get_current_user)):
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
        text("SELECT COUNT(*) FROM interview_questions WHERE interview_id = :id"),
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
# Phase 4C: AI question generation
# ---------------------------

class GenerateIn(BaseModel):
    interview_id: UUID
    count: Optional[int] = None
    extract_resume: bool = True
    replace: bool = False  # clear existing questions before generating


@router.post("/generate")
def generate_questions(payload: GenerateIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    row = db.execute(text("""
        SELECT id, role_id, resume_id
        FROM interviews
        WHERE id = :iid
    """), {"iid": str(payload.interview_id)}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="interview not found")
    if not row["role_id"]:
        raise HTTPException(status_code=400, detail="role_id missing on interview")
    if not row["resume_id"]:
        raise HTTPException(status_code=400, detail="resume_id missing on interview")

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
# Task status helper (useful while testing)
# ---------------------------
@router.get("/task/{task_id}")
def get_task_status(task_id: str):
    try:
        res: AsyncResult = AsyncResult(task_id, app=celery_app)
        return {"task_id": task_id, "status": res.status, "result": res.result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"failed to inspect task: {e}")


# ---------------------------
# Record answer (video/code)
# ---------------------------

class RecordAnswer(BaseModel):
    question_id: int
    upload_id: Optional[int] = None
    code_answer: Optional[str] = None
    code_output: Optional[str] = None
    test_results: Optional[dict[str, Any]] = None

@router.post("/answer")
def record_answer(payload: RecordAnswer, db: Session = Depends(get_db), user=Depends(get_current_user)):
    qid = db.execute(
        text("SELECT id FROM interview_questions WHERE id = :qid"),
        {"qid": payload.question_id}
    ).scalar()
    if not qid:
        raise HTTPException(status_code=404, detail="Question not found")

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
    qcol = db.execute(text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'interview_answers'
          AND column_name IN ('interview_question_id','question_id')
        LIMIT 1
    """)).scalar()
    if not qcol:
        raise HTTPException(500, "interview_answers missing FK column")

    has_created_at = db.execute(text("""
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'interview_answers' AND column_name = 'created_at'
        LIMIT 1
    """)).scalar() is not None
    order_clause = "created_at DESC NULLS LAST" if has_created_at else "id DESC"

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
        raise HTTPException(status_code=404, detail="No answer found to attach flags (save an answer first)")

    cur = db.execute(text("SELECT cheat_flags FROM interview_answers WHERE id = :aid"), {"aid": answer_id}).scalar()
    try:
        cur_list = json.loads(cur) if isinstance(cur, str) else (cur or [])
    except Exception:
        cur_list = []
    if not isinstance(cur_list, list):
        cur_list = []

    merged = list(dict.fromkeys([*cur_list, *payload.flags]))

    from sqlalchemy.dialects.postgresql import JSONB
    upd = text("UPDATE interview_answers SET cheat_flags = :merged WHERE id = :aid RETURNING id")
    upd = upd.bindparams(merged=merged)
    updated_id = db.execute(upd, {"merged": merged, "aid": answer_id}).scalar()
    db.commit()

    if not updated_id:
        raise HTTPException(status_code=500, detail="Failed to update cheat_flags")

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
    total = db.execute(
        text("SELECT COUNT(*) FROM interview_questions WHERE interview_id = :iid"),
        {"iid": str(interview_id)}
    ).scalar() or 0

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
    """
    Return per-question report. Includes:
    - latest answer (transcript, ai_feedback, etc)
    - **latest llm_raw from interview_scores** (if any) as `llm_raw`
    """
    rows = db.execute(
        text("""
            SELECT
              q.id AS question_id, q.type, q.question_text, q.time_limit_seconds,
              a.id AS answer_id, a.upload_id, a.code_answer, a.code_output,
              a.test_results, a.cheat_flags, a.transcript, a.ai_feedback, a.created_at,
              s.llm_raw AS llm_raw
            FROM interview_questions q
            LEFT JOIN LATERAL (
              SELECT * FROM interview_answers a2
              WHERE a2.interview_question_id = q.id
              ORDER BY a2.created_at DESC NULLS LAST
              LIMIT 1
            ) a ON TRUE
            LEFT JOIN LATERAL (
              SELECT llm_raw FROM interview_scores s2
              WHERE s2.question_id = q.id AND s2.interview_id = :iid
              ORDER BY s2.id DESC
              LIMIT 1
            ) s ON TRUE
            WHERE q.interview_id = :iid
            ORDER BY q.id ASC
        """),
        {"iid": str(interview_id)}
    ).mappings().all()
    return [dict(r) for r in rows]


@router.post("/score/{interview_id}")
def score_now(interview_id: UUID, user=Depends(get_current_user)):
    task = score_interview.delay(str(interview_id))
    return {"queued": True, "task_id": task.id}


@router.post("/report/{interview_id}/pdf")
def pdf_now(interview_id: UUID, user=Depends(get_current_user)):
    """
    Queue PDF generation. The generate_pdf task should:
      - create the PDF file
      - upload it to S3/MinIO under a stable key (e.g. reports/{interview_id}.pdf or reports/<fname>)
      - update interviews.pdf_key in the DB with that key
    """
    task = generate_pdf.delay(str(interview_id))
    return {"queued": True, "task_id": task.id}


@router.get("/report/{interview_id}/pdf")
def pdf_info(interview_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    Return PDF location (and a presigned URL if possible).
    Validates object exists in S3/MinIO before returning the presigned URL.
    """
    key = db.execute(text("SELECT pdf_key FROM interviews WHERE id = :i"), {"i": str(interview_id)}).scalar()
    if not key:
        raise HTTPException(status_code=404, detail="PDF not ready")

    bucket = getattr(settings, "S3_BUCKET", getattr(settings, "s3_bucket", None))
    if not bucket:
        raise HTTPException(status_code=500, detail="Bucket not configured")

    # Try to verify object exists, then presign
    try:
        s3 = get_s3_client()
        # verify object exists
        s3.head_object(Bucket=bucket, Key=key)
    except Exception as e:
        # if head_object fails, return helpful message
        raise HTTPException(status_code=404, detail=f"PDF not found in bucket (key: {key}) - {e}")

    try:
        expires = int(getattr(settings, "PRESIGNED_URL_EXPIRES", 900))
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires,
        )
    except Exception:
        url = None

    return {"bucket": bucket, "key": key, "presigned_url": url}


# AI health-check endpoint
@router.get("/ai/health")
def ai_health_check():
    provider = os.getenv("AI_PROVIDER", "stub").lower()
    ollama_url = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
    model_name = os.getenv("OLLAMA_MODEL", "tinyllama")

    result = {
        "provider": provider,
        "ollama": None,
        "model_found": False,
        "models": []
    }

    if provider != "ollama":
        result["ollama"] = "skipped (provider != ollama)"
        return result

    try:
        with httpx.Client(timeout=5) as client:
            r = client.get(f"{ollama_url.rstrip('/')}/api/tags")
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        result["ollama"] = "error"
        result["error"] = f"Ollama unreachable: {e}"
        return result

    result["ollama"] = "ok"
    models_list = data.get("models", []) if isinstance(data, dict) else []
    result["models"] = models_list
    available_names = [
        m.get("model") or m.get("name")
        for m in models_list if isinstance(m, dict)
    ]
    for name in available_names:
        if not name:
            continue
        if model_name in name:
            result["model_found"] = True
            break
    return result


from fastapi import Body

@router.post("/ai/debug_generate")
def ai_debug_generate(jd: str = Body(...), resume: str = Body(...), count: int = 3):
    from tasks.question_tasks import _llm_json
    import asyncio
    out = asyncio.run(_llm_json(jd, resume, count))
    return {"parsed": out}


@router.get("/scores/{interview_id}")
def get_interview_scores(interview_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = db.execute(
        text("""
            SELECT id, interview_id, question_id, technical_score, communication_score,
                   completeness_score, overall_score, ai_feedback, created_at, llm_raw
            FROM interview_scores
            WHERE interview_id = :iid
            ORDER BY id ASC
        """),
        {"iid": str(interview_id)}
    ).mappings().all()
    return [dict(r) for r in rows]

@router.post("/score_question/{question_id}")
def score_question(question_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    Map a question_id -> interview_id and enqueue the scoring job for that interview.
    This is a pragmatic fix so the UI's per-question Re-score button doesn't 404.
    If you implement a true single-question scoring task, replace this to call that task.
    """
    # find interview id for this question
    iid = db.execute(
        text("SELECT interview_id FROM interview_questions WHERE id = :qid"),
        {"qid": int(question_id)}
    ).scalar()
    if not iid:
        raise HTTPException(status_code=404, detail="Question or interview not found")

    # enqueue the whole-interview scorer (use existing task)
    task = score_interview.delay(str(iid))
    return {"queued": True, "task_id": task.id, "interview_id": str(iid)}

@router.get("/{interview_id}/audit")
def list_audit(interview_id: str, limit: int = Query(20, ge=1, le=200), db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    List recent audit runs for an interview.
    Returns array of audit metadata (id, scored_at, overall_score, triggered_by, task_id, llm_raw_s3_key).
    """
    try:
        rows = db.execute(
            text("""
                SELECT id, interview_id, scored_at, overall_score, section_scores, per_question,
                       model_meta, prompt_hash, weights, triggered_by, task_id, llm_raw_s3_key, notes, created_at
                FROM interview_score_audit
                WHERE interview_id = :iid
                ORDER BY created_at DESC
                LIMIT :lim
            """),
            {"iid": str(interview_id), "lim": int(limit)}
        ).mappings().all()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"failed to query audit: {e}")


@router.get("/{interview_id}/audit/{audit_id}")
def get_audit_detail(interview_id: str, audit_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    Return a single audit row. If llm_raw_s3_key is present and S3 configured,
    return a presigned_url for direct download (expires per settings.PRESIGNED_URL_EXPIRES).
    """
    try:
        row = db.execute(
            text("""
                SELECT id, interview_id, scored_at, overall_score, section_scores, per_question,
                       model_meta, prompt_hash, prompt_text, weights, triggered_by, task_id, llm_raw_s3_key, notes, created_at
                FROM interview_score_audit
                WHERE interview_id = :iid AND id = :aid
                LIMIT 1
            """),
            {"iid": str(interview_id), "aid": int(audit_id)}
        ).mappings().first()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"failed to query audit detail: {e}")

    if not row:
        raise HTTPException(status_code=404, detail="audit entry not found")

    result = dict(row)

    s3_key = result.get("llm_raw_s3_key")
    presigned = None
    if s3_key:
        # guard: try to create presigned URL, but don't fail if S3 misconfigured
        try:
            s3 = get_s3_client()
            bucket = getattr(settings, "S3_BUCKET", None) or getattr(settings, "s3_bucket", None)
            if s3 and bucket:
                expires = int(getattr(settings, "PRESIGNED_URL_EXPIRES", 900))
                presigned = s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": bucket, "Key": s3_key},
                    ExpiresIn=expires
                )
        except Exception as e:
            # Log via HTTPException detail? better to return info but not fail
            result["llm_raw_presign_error"] = str(e)

    result["llm_raw_presigned_url"] = presigned
    return result