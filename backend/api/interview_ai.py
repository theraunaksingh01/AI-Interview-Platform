# backend/api/interview_ai.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import text
from api.deps import get_db, get_current_user
from tasks.resume_tasks import extract_resume_text
from tasks.question_tasks import generate_questions_ai

router = APIRouter(prefix="/interview", tags=["interview"])

class GenAIIn(BaseModel):
    interview_id: UUID
    count: int | None = None
    extract_resume: bool = True   # run OCR/text-extraction first

@router.post("/generate_ai")
def generate_ai(payload: GenAIIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # sanity: interview exists & has (role_id, resume_id)
    row = db.execute(text("""
        SELECT id, role_id, resume_id FROM interviews WHERE id=:iid
    """), {"iid": str(payload.interview_id)}).mappings().first()
    if not row:
        raise HTTPException(404, "interview not found")
    if not row["role_id"]:
        raise HTTPException(400, "role_id missing on interview")
    if not row["resume_id"]:
        raise HTTPException(400, "resume_id missing on interview")

    # (A) Extract resume text (async task)
    if payload.extract_resume:
        extract_resume_text.delay(int(row["resume_id"]))

    # (B) Generate questions (async task)
    r = generate_questions_ai.delay(str(payload.interview_id), payload.count)
    return {"queued": True, "task_id": r.id}
