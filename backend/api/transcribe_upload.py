# backend/api/transcribe_upload.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.deps import get_current_user
from db.session import get_db
from db.models import Upload
from tasks.transcribe import transcribe_upload  # your Celery task that handles Uploads

router = APIRouter(prefix="/transcribe", tags=["transcription"])

@router.post("/upload/{upload_id}")
def transcribe_upload_sync(upload_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    upl = db.query(Upload).filter(Upload.id == upload_id, Upload.user_id == user.id).one_or_none()
    if not upl:
        raise HTTPException(404, "Upload not found")
    # run synchronously for quick test
    return transcribe_upload(upload_id)

@router.post("/upload/{upload_id}/enqueue")
def transcribe_upload_enqueue(upload_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    upl = db.query(Upload).filter(Upload.id == upload_id, Upload.user_id == user.id).one_or_none()
    if not upl:
        raise HTTPException(404, "Upload not found")
    r = transcribe_upload.delay(upload_id)
    return {"queued": True, "task_id": r.id}
