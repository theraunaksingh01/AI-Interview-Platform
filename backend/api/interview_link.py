# backend/api/interview_link.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from uuid import UUID
from sqlalchemy import text
from sqlalchemy.orm import Session
from api.deps import get_db, get_current_user

router = APIRouter(prefix="/interview", tags=["interview"])

class LinkIn(BaseModel):
    interview_id: UUID
    role_id: int
    resume_id: int

@router.post("/link")
def link_interview(payload: LinkIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    try:
        # (optional) sanity checks
        if not db.execute(text("SELECT 1 FROM roles WHERE id=:rid"), {"rid": payload.role_id}).scalar():
            raise HTTPException(404, "role not found")
        if not db.execute(text("SELECT 1 FROM candidate_resumes WHERE id=:rsid"), {"rsid": payload.resume_id}).scalar():
            raise HTTPException(404, "resume not found")

        updated = db.execute(
            text("""
                UPDATE interviews
                   SET role_id = :rid,
                       resume_id = :rsid
                 WHERE id = CAST(:iid AS uuid)
             RETURNING id
            """),
            {
                "rid": payload.role_id,
                "rsid": payload.resume_id,
                "iid": str(payload.interview_id),   # ← IMPORTANT: pass iid
            },
        ).scalar()

        db.commit()
        if not updated:
            raise HTTPException(404, "interview not found")
        return {"ok": True, "interview_id": str(updated)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"/interview/link failed: {e}")
