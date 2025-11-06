# backend/api/score.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json

from api.deps import get_current_user
from db.session import get_db
from db.models import Upload

router = APIRouter(prefix="/score", tags=["scoring"])

class ScoreOut(BaseModel):
    communication: int
    technical: int
    completeness: int
    red_flags: list[str]
    summary: str

def _score_heuristic(transcript: str) -> ScoreOut:
    t = (transcript or "").strip()
    if not t:
        return ScoreOut(
            communication=0,
            technical=0,
            completeness=0,
            red_flags=["No speech detected"],
            summary="No audio or empty transcript detected. Unable to evaluate."
        )
    words = t.split()
    length = len(words)

    communication = min(10, max(3, length // 50))
    technical = min(10, max(3, length // 60))
    completeness = min(10, 5
        + (1 if "because" in t.lower() else 0)
        + (1 if "therefore" in t.lower() else 0)
        + (1 if "in summary" in t.lower() else 0)
    )
    red_flags: list[str] = []
    if length < 30:
        red_flags.append("Very short answer")

    return ScoreOut(
        communication=communication,
        technical=technical,
        completeness=completeness,
        red_flags=red_flags,
        summary="Auto-scored heuristically (placeholder)."
    )

@router.post("/upload/{upload_id}", response_model=ScoreOut)
def score_upload(
    upload_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    upl = db.query(Upload).filter(Upload.id == upload_id, Upload.user_id == user.id).one_or_none()
    if not upl:
        raise HTTPException(status_code=404, detail="Upload not found")

    result = _score_heuristic(upl.transcript or "")

    # store in DB (JSON or TEXT depending on your column type)
    try:
        # JSONB: store dict
        if hasattr(Upload, "ai_feedback") and str(Upload.ai_feedback.type) == "JSONB":
            upl.ai_feedback = result.model_dump()
        else:
            # TEXT fallback
            upl.ai_feedback = json.dumps(result.model_dump())

        db.add(upl)
        db.commit()
        db.refresh(upl)
    except Exception:
        db.rollback()

    return result
