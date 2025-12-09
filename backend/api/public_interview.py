# backend/api/public_interview.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from db.session import SessionLocal
from uuid import uuid4
import shutil, os, traceback
from typing import Optional

# Try to import tasks if available (best-effort)
try:
    from tasks.question_tasks import generate_questions_ai
except Exception:
    generate_questions_ai = None

try:
    from tasks.score_question import score_question
except Exception:
    score_question = None

router = APIRouter(prefix="/public", tags=["public"])

TMP_UPLOAD_DIR = os.path.join(os.getcwd(), "tmp_uploads")
os.makedirs(TMP_UPLOAD_DIR, exist_ok=True)


@router.post("/interview/submit")
async def public_submit_interview(
    name: str = Form(...),
    email: str = Form(...),
    role_id: Optional[int] = Form(None),
    resume: UploadFile = File(...),
):
    """
    Candidate-facing submit endpoint (demo). Saves resume locally, inserts a minimal
    interview row and candidate_resumes / uploads entries if tables exist.
    Returns { interview_id, candidate_url } where candidate_url is a frontend path.
    """
    db = SessionLocal()
    tmp_path = os.path.join(TMP_UPLOAD_DIR, f"{uuid4().hex}_{resume.filename}")
    try:
        # Save locally
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(resume.file, f)

        # Try to insert into uploads table (best-effort)
        upload_id = None
        try:
            r = db.execute(text("""
                INSERT INTO uploads ("key", filename, content_type, size, created_at, status, user_id)
                VALUES (:k, :fn, :ct, :sz, now(), 'done', 1)
                RETURNING id
            """), {"k": tmp_path, "fn": resume.filename, "ct": resume.content_type or "application/octet-stream", "sz": os.path.getsize(tmp_path)})
            row = r.fetchone()
            db.commit()
            if row:
                upload_id = int(row[0])
        except Exception:
            db.rollback()
            upload_id = None

        # Try to insert candidate_resumes if table exists
        candidate_resume_id = None
        try:
            r = db.execute(text("""
                INSERT INTO candidate_resumes (user_id, role_id, upload_id, created_at)
                VALUES (1, :role_id, :upload_id, now())
                RETURNING id
            """), {"role_id": role_id, "upload_id": upload_id})
            row = r.fetchone()
            db.commit()
            if row:
                candidate_resume_id = int(row[0])
        except Exception:
            db.rollback()
            candidate_resume_id = None

        # Create interview row (defensive: try richer insert then fallback)
        iid = str(uuid4())
        try:
            # Try richer insert first (if columns exist)
            db.execute(text("""
                INSERT INTO interviews (id, candidate_name, candidate_email, role_id, resume_id, created_at)
                VALUES (CAST(:iid AS uuid), :name, :email, :role_id, :resume_id, now())
            """), {"iid": iid, "name": name, "email": email, "role_id": role_id, "resume_id": candidate_resume_id})
            db.commit()
        except Exception as exc:
            db.rollback()
            # Fallback to minimal insert (most schemas will allow id + created_at)
            try:
                db.execute(text("""
                    INSERT INTO interviews (id, role_id, resume_id, created_at)
                    VALUES (CAST(:iid AS uuid), :role_id, :resume_id, now())
                """), {"iid": iid, "role_id": role_id, "resume_id": candidate_resume_id})
                db.commit()
            except Exception as exc2:
                db.rollback()
                raise HTTPException(status_code=500, detail=f"Failed to create interview (rich and fallback failed): {exc} | {exc2}")

        # enqueue question generation if available (best-effort)
        if generate_questions_ai:
            try:
                # signature may be (interview_id) or (interview_id, resume_id)
                try:
                    if candidate_resume_id:
                        generate_questions_ai.delay(iid, candidate_resume_id)
                    else:
                        generate_questions_ai.delay(iid)
                except TypeError:
                    generate_questions_ai.delay(iid)
            except Exception:
                # swallow task enqueue errors for demo
                pass

        candidate_url = f"/candidate/interview?interview_id={iid}"
        return JSONResponse({"ok": True, "interview_id": iid, "candidate_url": candidate_url})
    finally:
        try:
            resume.file.close()
        except Exception:
            pass
        db.close()


@router.get("/interview/{interview_id}/questions")
def public_get_questions(interview_id: str):
    """
    Candidate fetch of generated questions.
    Returns 200 + array when questions exist, 404 when not found (so clients can poll).
    """
    db = SessionLocal()
    try:
        rows = db.execute(text("""
            SELECT id, question_text, type
            FROM interview_questions
            WHERE interview_id = CAST(:iid AS uuid)
            ORDER BY id
        """), {"iid": interview_id}).mappings().all()
        if not rows:
            raise HTTPException(status_code=404, detail="questions not found")
        out = []
        for r in rows:
            out.append({
                "question_id": r["id"],
                "question_text": r["question_text"],
                "type": r["type"] or "voice",
            })
        return out
    finally:
        db.close()


@router.post("/interview/{interview_id}/answer")
async def public_submit_answer(interview_id: str, request: Request):
    """
    Candidate posts an answer for a question. Demo-friendly: accepts form fields:
      - question_id (int)
      - answer_text (string)
    For file uploads (recordings) you can extend this handler.
    Enqueues scoring if per-question task available.
    """
    db = SessionLocal()
    try:
        form = await request.form()
        qid = form.get("question_id") or form.get("questionId")
        answer_text = form.get("answer_text") or form.get("answerText") or form.get("text")

        if not qid:
            raise HTTPException(status_code=400, detail="question_id required")
        qid = int(qid)

        # Insert into interview_answers (best-effort columns)
        try:
            r = db.execute(text("""
                INSERT INTO interview_answers (interview_question_id, transcript, created_at)
                VALUES (:qid, :txt, now())
                RETURNING id
            """), {"qid": qid, "txt": answer_text})
            row = r.fetchone()
            db.commit()
            answer_id = int(row[0]) if row else None
        except Exception:
            db.rollback()
            # Last-resort fallback: do nothing but continue
            answer_id = None

        # Optionally trigger per-question scoring task
        if score_question:
            try:
                # signature may be (question_id, interview_id) or (interview_question_id)
                try:
                    score_question.delay(qid)
                except TypeError:
                    # older version expects interview_id too
                    score_question.delay(qid, interview_id)
            except Exception:
                pass

        return {"ok": True, "answer_id": answer_id}
    finally:
        db.close()


@router.get("/interview/{interview_id}/status")
def public_interview_status(interview_id: str):
    """
    Helpful debug endpoint for candidate/demo: returns basic interview row info and counts.
    """
    db = SessionLocal()
    try:
        row = db.execute(text("""
            SELECT id, resume_id, role_id, report IS NOT NULL AS has_report
            FROM interviews
            WHERE id = CAST(:iid AS uuid)
        """), {"iid": interview_id}).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="interview not found")
        qcount = db.execute(text("""
            SELECT count(*) FROM interview_questions WHERE interview_id = CAST(:iid AS uuid)
        """), {"iid": interview_id}).scalar() or 0
        return {"interview_id": str(row["id"]), "resume_id": row.get("resume_id"), "role_id": row.get("role_id"), "has_report": bool(row.get("has_report")), "questions": int(qcount)}
    finally:
        db.close()
