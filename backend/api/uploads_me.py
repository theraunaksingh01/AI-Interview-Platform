# backend/api/uploads_me.py  
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Literal, List
from api.deps import get_db, get_current_user
from db.models import Upload
from .uploads import UploadOut

router = APIRouter(prefix="/uploads", tags=["uploads"])

@router.get("/me", response_model=List[UploadOut])
def list_my_uploads(
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: Literal["created_desc", "created_asc"] = "created_desc",
):
    q = db.query(Upload).filter(Upload.user_id == user.id)
    q = q.order_by(Upload.created_at.desc() if sort == "created_desc" else Upload.created_at.asc())
    return q.limit(limit).offset(offset).all()
