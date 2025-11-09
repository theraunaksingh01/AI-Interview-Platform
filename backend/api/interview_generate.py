# backend/api/interview_generate.py (new file)
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from api.deps import get_db, get_current_user

router = APIRouter(prefix="/interview", tags=["interview"])

class GenIn(BaseModel):
    interview_id: str  # UUID

@router.post("/generate")
def generate_questions(payload: GenIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    row = db.execute(
        text("SELECT role_id, resume_id FROM interviews WHERE id=:iid"),
        {"iid": str(payload.interview_id)}
    ).mappings().first()
    if not row or not row["role_id"] or not row["resume_id"]:
        raise HTTPException(400, "interview must have role_id and resume_id before generation")

    # simple deterministic set (you can later swap to Celery + LLM)
    questions = [
        ("voice", "Tell me about a project where you used FastAPI/PostgreSQL.", 120),
        ("code", "Write code for Tower of Hanoi.", 300),
        ("voice", "Explain database indexing vs partitioning in simple words.", 120)
    ]

    # clear old & insert new
    db.execute(text("DELETE FROM interview_questions WHERE interview_id=:iid"), {"iid": str(payload.interview_id)})
    for t, q, secs in questions:
        db.execute(text("""
            INSERT INTO interview_questions (interview_id, question_text, type, time_limit_seconds, source)
            VALUES (:iid, :q, :t, :s, 'ai-generated')
        """), {"iid": str(payload.interview_id), "q": q, "t": t, "s": secs})
    db.commit()
    return {"ok": True, "count": len(questions)}
