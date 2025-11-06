# backend/api/interview.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import UUID
from pydantic import BaseModel

from api.deps import get_db, get_current_user
from tasks.transcribe import transcribe_upload  


router = APIRouter(prefix="/interview", tags=["interview"])

@router.post("/start")
def start_interview(db: Session = Depends(get_db), user=Depends(get_current_user)):
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

@router.post("/seed/{interview_id}")
def seed_questions(interview_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    exists = db.execute(text("SELECT 1 FROM interviews WHERE id = :id"), {"id": str(interview_id)}).scalar()
    if not exists:
        raise HTTPException(status_code=404, detail="Interview not found")

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
    return {"ok": True}

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

# ---------- NEW: save answer (video or code) ----------
class RecordAnswer(BaseModel):
    question_id: int
    upload_id: int | None = None   # for voice answers
    code_answer: str | None = None # for code answers

@router.post("/answer")
def record_answer(payload: RecordAnswer, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # ensure question exists
    q = db.execute(
        text("SELECT id, type FROM interview_questions WHERE id = :qid"),
        {"qid": payload.question_id}
    ).mappings().first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    db.execute(
        text("""
            INSERT INTO interview_answers (interview_question_id, upload_id, code_answer)
            VALUES (:qid, :uid, :code)
        """),
        {"qid": payload.question_id, "uid": payload.upload_id, "code": payload.code_answer},
    )
    db.commit()
    return {"ok": True}

# ---------- OPTIONAL: simple report ----------
@router.get("/report/{interview_id}")
def report(interview_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = db.execute(
        text("""
            SELECT q.id as question_id, q.type, q.question_text,
                   a.upload_id, a.code_answer, a.transcript, a.ai_feedback, a.red_flags, a.created_at
            FROM interview_questions q
            LEFT JOIN interview_answers a ON a.interview_question_id = q.id
            WHERE q.interview_id = :id
            ORDER BY q.id ASC, a.created_at ASC
        """),
        {"id": str(interview_id)}
    ).mappings().all()
    return [dict(r) for r in rows]
