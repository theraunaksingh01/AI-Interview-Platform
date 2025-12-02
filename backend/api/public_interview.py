# backend/api/public_interview.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from db.session import SessionLocal
from uuid import uuid4
import shutil
import os
from typing import Optional

# if you have a task to generate questions (question_tasks.generate_questions_ai)
try:
    from tasks.question_tasks import generate_questions_ai
except Exception:
    generate_questions_ai = None

# if you implemented per-question scoring task
try:
    from tasks.score_question import score_question
except Exception:
    score_question = None

router = APIRouter(prefix="/public", tags=["public"])


# ---------------------------------------------------------
# 1) PUBLIC submit: candidate fills form + uploads resume
#    -> creates interview row
#    -> stores resume via uploads table
#    -> optionally kicks off generate_questions_ai
# ---------------------------------------------------------
@router.post("/interview/submit")
async def public_submit_interview(
    name: str = Form(...),
    email: str = Form(...),
    role_id: Optional[int] = Form(None),
    resume: UploadFile = File(...),
):
    db: Session = SessionLocal()
    tmpdir = os.path.join(os.getcwd(), "tmp_uploads")
    os.makedirs(tmpdir, exist_ok=True)
    tmp_path = os.path.join(tmpdir, f"{uuid4().hex}_{resume.filename}")

    try:
        # Save file locally (demo). Your real pipeline uses /upload/proxy + Celery,
        # but for this public demo we just store a local copy.
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(resume.file, f)

        # Insert into uploads so the file is tracked in the system
        upload_id = None
        try:
            res = db.execute(
                text(
                    """
                    INSERT INTO uploads (user_id, "key", filename, content_type, size, created_at, status)
                    VALUES (:uid, :key, :fn, :ct, :size, now(), 'done')
                    RETURNING id
                    """
                ),
                {
                    "uid": 1,  # demo admin user
                    "key": f"local/tmp_uploads/{os.path.basename(tmp_path)}",
                    "fn": resume.filename,
                    "ct": resume.content_type or "application/octet-stream",
                    "size": os.path.getsize(tmp_path),
                },
            )
            row = res.fetchone()
            db.commit()
            if row:
                upload_id = int(row[0])
        except Exception:
            db.rollback()
            upload_id = None

        # Optional: track resume in candidate_resumes if schema matches
        resume_id = None
        try:
            # Your candidate_resumes columns are something like:
            # id, user_id, role_id, upload_id, plain_text, skills, parsed, created_at
            res2 = db.execute(
                text(
                    """
                    INSERT INTO candidate_resumes (user_id, role_id, upload_id, plain_text, skills, parsed, created_at)
                    VALUES (:uid, :role_id, :upload_id, '', '[]', '', now())
                    RETURNING id
                    """
                ),
                {
                    "uid": 1,
                    "role_id": role_id,
                    "upload_id": upload_id,
                },
            )
            row2 = res2.fetchone()
            db.commit()
            if row2:
                resume_id = int(row2[0])
        except Exception:
            db.rollback()
            resume_id = None

        # Create interview row
        iid = str(uuid4())

        try:
            db.execute(
                text(
                    """
                    INSERT INTO interviews (id, role_id, resume_id, candidate_name, candidate_email, created_at)
                    VALUES (CAST(:iid AS uuid), :role_id, :resume_id, :name, :email, now())
                    """
                ),
                {
                    "iid": iid,
                    "role_id": role_id,
                    "resume_id": resume_id,
                    "name": name,
                    "email": email,
                },
            )
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create interview: {e}",
            )

        # enqueue question generation if available (best-effort)
        if generate_questions_ai:
            try:
                # your task signature was generate_questions_ai(interview_id=..., resume_id=..., role_id=...)
                # but in earlier logs it tolerated missing resume_id/role_id after we fixed things.
                generate_questions_ai.delay(iid)
            except Exception:
                pass

        candidate_url = f"/candidate/interview?interview_id={iid}"
        return JSONResponse(
            {
                "ok": True,
                "interview_id": iid,
                "candidate_url": candidate_url,
            }
        )

    finally:
        try:
            resume.file.close()
        except Exception:
            pass
        db.close()


# ---------------------------------------------------------
# 2) PUBLIC GET questions for an interview
#    (no authentication required)
#    -> used by /candidate/interview page
# ---------------------------------------------------------
@router.get("/interview/{interview_id}/questions")
def public_get_questions(interview_id: str):
    db: Session = SessionLocal()
    try:
        rows = db.execute(
            text(
                """
                SELECT id, question_text, type
                FROM interview_questions
                WHERE interview_id = :iid
                ORDER BY id
                """
            ),
            {"iid": interview_id},
        ).mappings().all()

        return [
            {
                "id": r["id"],
                "question_id": r["id"],
                "question_text": r["question_text"],
                "type": r["type"],
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load questions: {e}")
    finally:
        db.close()


# ---------------------------------------------------------
# 3) PUBLIC submit an answer for a question (text demo)
#    -> inserts into interview_answers.transcript
#    -> optionally fires score_question Celery task
# ---------------------------------------------------------
@router.post("/interview/{interview_id}/answer")
async def public_submit_answer(
    interview_id: str,
    question_id: int = Form(...),
    answer_text: str = Form(...),
):
    db: Session = SessionLocal()
    try:
        # Ensure question belongs to this interview
        qid_row = db.execute(
            text(
                """
                SELECT id
                FROM interview_questions
                WHERE id = :qid AND interview_id = :iid
                """
            ),
            {"qid": question_id, "iid": interview_id},
        ).scalar()

        if not qid_row:
            raise HTTPException(
                status_code=400,
                detail="Question does not belong to this interview",
            )

        # Insert answer as transcript (demo: text instead of audio)
        res = db.execute(
            text(
                """
                INSERT INTO interview_answers (interview_question_id, transcript, created_at)
                VALUES (:qid, :txt, now())
                RETURNING id
                """
            ),
            {"qid": question_id, "txt": answer_text},
        )
        ans_id = res.scalar()
        db.commit()

        # Optionally trigger per-question scoring
        if score_question:
            try:
                score_question.delay(question_id, interview_id)
            except Exception:
                # non-fatal for demo
                pass

        return {"ok": True, "answer_id": ans_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to submit answer: {e}")
    finally:
        db.close()
