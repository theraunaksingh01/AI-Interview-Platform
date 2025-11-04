# api/uploads_me.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from api.deps import get_current_user, get_db
from db import models
from typing import List

router = APIRouter(prefix="/uploads", tags=["uploads"])

@router.get("/me", response_model=List[dict])
def list_my_uploads(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    uploads = db.query(models.Upload).filter(models.Upload.user_id == current_user.id).order_by(models.Upload.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "key": u.key,
            "filename": u.filename,
            "content_type": u.content_type,
            "size": u.size,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in uploads
    ]
