# backend/api/resumes.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from api.deps import get_db, get_current_user

router = APIRouter(prefix="/resumes", tags=["resumes"])

class ResumeAttachIn(BaseModel):
    role_id: int
    upload_id: int  # PDF already uploaded via /upload/proxy

@router.post("/attach")
def attach_resume(payload: ResumeAttachIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # ✅ check in roles (your existing table), not job_roles
    has_role = db.execute(text("SELECT 1 FROM roles WHERE id=:rid"), {"rid": payload.role_id}).scalar()
    if not has_role:
        raise HTTPException(404, "role not found")

    # insert candidate_resumes row
    resume_id = db.execute(
        text("""
            INSERT INTO candidate_resumes (user_id, role_id, upload_id)
            VALUES (:uid, :rid, :up) RETURNING id
        """),
        {"uid": int(user.id), "rid": payload.role_id, "up": payload.upload_id},
    ).scalar()
    db.commit()
    return {"resume_id": resume_id}
