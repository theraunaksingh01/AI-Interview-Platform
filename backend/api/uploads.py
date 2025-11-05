# backend/api/uploads.py
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from sqlalchemy.orm import Session

from api.deps import get_db, get_current_user
from core.config import settings
from core.s3_client import get_s3_client
from db.models import Upload, UploadStatus
from tasks.transcribe import transcribe_upload
import logging


router = APIRouter(prefix="/upload", tags=["upload"])
logger = logging.getLogger("uploads")



# ---- validation policy (tweak as you like)
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "text/plain",
    "audio/mpeg",           # .mp3
    "audio/wav",            # .wav
    "audio/x-wav",
    "video/mp4",            # .mp4
    "application/octet-stream",  # fallback; allow in dev
}

class PresignRequest(BaseModel):
    filename: str
    content_type: str | None = None
    folder: str | None = None

class PresignResponse(BaseModel):
    url: str
    key: str
    expires_in: int

class UploadOut(BaseModel):
    id: int
    key: str
    filename: str
    content_type: Optional[str] = None
    size: Optional[int] = None
    status: str
    processor_job_id: Optional[str] = None
    transcript: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

def _require_allowed_type(ct: Optional[str]):
    # allow empty type in dev
    if not ct:
        return
    if ct not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content-type '{ct}'. Allowed: {sorted(ALLOWED_CONTENT_TYPES)}",
        )

@router.post("/proxy", response_model=UploadOut)
async def proxy_upload(
    file: UploadFile = File(...),
    folder: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    s3 = get_s3_client()
    bucket = settings.s3_bucket if hasattr(settings, "s3_bucket") else settings.S3_BUCKET
    if not bucket:
        raise HTTPException(status_code=500, detail="S3 bucket not configured")

    _require_allowed_type(file.content_type)

    # Read with max limit
    data = await file.read()
    await file.close()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(data)} bytes). Max allowed is {MAX_UPLOAD_BYTES} bytes.",
        )

    safe_folder = (folder.strip("/") + "/") if folder else ""
    unique_id = uuid.uuid4().hex
    safe_name = (file.filename or "upload.bin").replace(" ", "_")
    key = f"{safe_folder}{datetime.utcnow().strftime('%Y%m%d')}/{unique_id}_{safe_name}"

    # Put to S3/MinIO
    try:
        put_kwargs = {"Bucket": bucket, "Key": key, "Body": data}
        if file.content_type:
            put_kwargs["ContentType"] = file.content_type
        s3.put_object(**put_kwargs)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload to storage failed: {exc}")

    # Persist
    try:
        upload = Upload(
            user_id=user.id,
            key=key,
            filename=safe_name,
            content_type=file.content_type,
            size=len(data),
            status=UploadStatus.pending.value if hasattr(UploadStatus, "pending") else "pending",
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)
    except Exception as exc:
        db.rollback()
        # best-effort cleanup
        try:
            s3.delete_object(Bucket=bucket, Key=key)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"DB persist failed: {exc}")

    # Queue background job
    try:
        async_result = transcribe_upload.delay(upload.id)
        upload.processor_job_id = async_result.id
        db.add(upload)
        db.commit()
        db.refresh(upload)
    except Exception as exc:
        # db.rollback()
        # raise HTTPException(status_code=500, detail=f"Enqueue failed: {exc}")
        pass

    return upload

# ---- IMPORTANT: keep /me BEFORE {upload_id:int} to avoid collisions
@router.get("/me", response_model=List[UploadOut])
def list_my_uploads(
    status: Optional[UploadStatus] = Query(default=None, description="Filter by status"),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    q = db.query(Upload).filter(Upload.user_id == user.id)
    if status:
        q = q.filter(Upload.status == (status.value if hasattr(status, "value") else str(status)))
    return q.order_by(Upload.created_at.desc()).all()

@router.get("/{upload_id:int}", response_model=UploadOut)
def get_upload(
    upload_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    upload = (
        db.query(Upload)
        .filter(Upload.id == upload_id, Upload.user_id == user.id)
        .one_or_none()
    )
    if not upload:
        raise HTTPException(status_code=404, detail="Not found")
    return upload

@router.post("/{upload_id:int}/retry", response_model=UploadOut)
def retry_upload(
    upload_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    upload = (
        db.query(Upload)
        .filter(Upload.id == upload_id, Upload.user_id == user.id)
        .one_or_none()
    )
    if not upload:
        raise HTTPException(status_code=404, detail="Not found")

    # If already done, block retry (optional: allow retry-any)
    done_value = UploadStatus.done.value if hasattr(UploadStatus, "done") else "done"
    pending_value = UploadStatus.pending.value if hasattr(UploadStatus, "pending") else "pending"

    if str(upload.status) == done_value:
        raise HTTPException(status_code=400, detail="Already processed")

    # Reset status and clear any previous job id
    upload.status = pending_value
    upload.processor_job_id = None
    db.add(upload)
    db.commit()
    db.refresh(upload)

    # Try to enqueue; if it fails, DO NOT raise—return pending so UI can retry later
    try:
        async_result = transcribe_upload.delay(upload.id)
        upload.processor_job_id = async_result.id
        db.add(upload)
        db.commit()
        db.refresh(upload)
    except Exception as exc:
        logger.exception("Enqueue failed for upload %s: %s", upload.id, exc)

    return upload

@router.delete("/{upload_id:int}", status_code=204)
def delete_upload(
    upload_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Delete the DB row and the associated S3 object (best-effort).
    """
    s3 = get_s3_client()
    bucket = settings.s3_bucket if hasattr(settings, "s3_bucket") else settings.S3_BUCKET

    upload = (
        db.query(Upload)
        .filter(Upload.id == upload_id, Upload.user_id == user.id)
        .one_or_none()
    )
    if not upload:
        raise HTTPException(status_code=404, detail="Not found")

    key = upload.key
    try:
        db.delete(upload)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB delete failed: {exc}")

    # best-effort S3 delete (don't fail request if storage delete fails)
    try:
        if bucket and key:
            s3.delete_object(Bucket=bucket, Key=key)
    except Exception:
        pass

    return


