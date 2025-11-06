# backend/api/interview.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import UUID

from api.deps import get_db, get_current_user

router = APIRouter(prefix="/interview", tags=["interview"])


# ----------------------------------------------------
# 1) START INTERVIEW (creates a new interview row)
# ----------------------------------------------------
@router.post("/start")
def start_interview(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    Creates a new interview record and returns interview_id (UUID)
    """
    try:
        res = db.execute(
            text("""
                INSERT INTO interviews (user_id, status)
                VALUES (:user_id, 'recording')
                RETURNING id
            """),
            {"user_id": user.id},   # ✅ UUID stored correctly
        )
        interview_id = res.scalar_one()
        db.commit()
        return {"interview_id": str(interview_id)}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"/interview/start failed: {e}")


# ----------------------------------------------------
# 2) SEED QUESTIONS (voice + code demo questions)
# ----------------------------------------------------
@router.post("/seed/{interview_id}")
def seed_questions(interview_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    Inserts demo questions into interview_questions table
    """

    exists = db.execute(
        text("SELECT 1 FROM interviews WHERE id = :id"),
        {"id": str(interview_id)}
    ).scalar()

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
    return {"ok": True, "message": "Questions added"}


# ----------------------------------------------------
# 3) GET QUESTIONS FOR FRONTEND FLOW
# ----------------------------------------------------
@router.get("/questions/{interview_id}")
def get_questions(interview_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    Returns ordered list of questions for an interview
    """
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
