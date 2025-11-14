# backend/api/uploads.py
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid
import logging

from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc, text

from api.deps import get_db, get_current_user
from core.config import settings
from core.s3_client import get_s3_client
from db.models import Upload, UploadStatus
from tasks.transcribe import transcribe_upload
from tasks.resume_tasks import extract_resume_text  # <-- new

router = APIRouter(prefix="/upload", tags=["upload"])
logger = logging.getLogger("uploads")

# ---- Validation policy ----
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "text/plain",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "video/mp4",
    "video/webm",
    "application/octet-stream",
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
    ai_feedback: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---- utility ----
def _base_ct(ct: Optional[str]) -> Optional[str]:
    return ct.split(";", 1)[0].strip().lower() if ct else None

def _require_allowed_type(ct: Optional[str]):
    base = _base_ct(ct)
    if not base:
        return
    if base not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content-type '{ct}'. Allowed: {sorted(ALLOWED_CONTENT_TYPES)}",
        )


# =====================================================
# POST /upload/proxy  (proxy upload → DB + Celery queue)
# =====================================================
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
    base_ct = _base_ct(file.content_type)

    data = await file.read()
    await file.close()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(data)} bytes). Max is {MAX_UPLOAD_BYTES} bytes.",
        )

    safe_folder = (folder.strip("/") + "/") if folder else ""
    unique_id = uuid.uuid4().hex
    safe_name = (file.filename or "upload.bin").replace(" ", "_")
    key = f"{safe_folder}{datetime.utcnow().strftime('%Y%m%d')}/{unique_id}_{safe_name}"

    # upload to S3
    try:
        put_kwargs = {"Bucket": bucket, "Key": key, "Body": data}
        if base_ct:
            put_kwargs["ContentType"] = base_ct
        s3.put_object(**put_kwargs)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload to storage failed: {exc}")

    # Save DB record
    try:
        upload = Upload(
            user_id=user.id,
            key=key,
            filename=safe_name,
            content_type=base_ct,
            size=len(data),
            status=UploadStatus.pending.value if hasattr(UploadStatus, "pending") else "pending",
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)
    except Exception as exc:
        db.rollback()
        try:
            s3.delete_object(Bucket=bucket, Key=key)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"DB persist failed: {exc}")

    # If PDF/text resume, create candidate_resumes placeholder and enqueue resume extraction.
    # Otherwise enqueue normal media transcription.
    try:
        processor_result = None
        # treat plain/text and pdf as resume
        if base_ct in ("application/pdf", "text/plain"):
            # Ensure `candidate_resumes` row exists (graceful if table doesn't exist)
            try:
                cr_id = db.execute(
                    text("INSERT INTO candidate_resumes (upload_id, created_at) VALUES (:uid, now()) RETURNING id"),
                    {"uid": upload.id},
                ).scalar()
                db.commit()
                # enqueue resume extraction task (reads candidate_resumes -> downloads file -> extracts text)
                processor_result = extract_resume_text.delay(upload.id)
                upload.processor_job_id = processor_result.id
                db.add(upload); db.commit(); db.refresh(upload)
            except Exception as exc:
                # if candidate_resumes table doesn't exist, still attempt to enqueue extract task directly
                logger.exception("candidate_resumes insert failed (maybe table missing): %s", exc)
                processor_result = extract_resume_text.delay(upload.id)
                upload.processor_job_id = processor_result.id
                db.add(upload); db.commit(); db.refresh(upload)
        else:
            processor_result = transcribe_upload.delay(upload.id)
            upload.processor_job_id = processor_result.id
            db.add(upload); db.commit(); db.refresh(upload)
    except Exception as exc:
        logger.exception("Failed to enqueue processing task: %s", exc)

    return upload


# =====================================================
# GET /upload/me (pagination + sorting)
# =====================================================
@router.get("/me")
def list_my_uploads(
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("created_at"),
    order: str = Query("desc"),
):
    sort_col = {
        "created_at": Upload.created_at,
        "status": Upload.status,
        "size": Upload.size,
    }.get(sort, Upload.created_at)
    sort_dir = desc if order.lower() == "desc" else asc

    base_q = db.query(Upload).filter(Upload.user_id == user.id)
    total = db.query(func.count()).select_from(base_q.subquery()).scalar()

    items = (
        base_q.order_by(sort_dir(sort_col))
        .limit(limit)
        .offset(offset)
        .all()
    )

    return {"items": items, "total": total}


# =====================================================
# GET /upload/{id}
# =====================================================
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


# =====================================================
# POST /upload/{id}/retry
# =====================================================
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

    done_value = UploadStatus.done.value if hasattr(UploadStatus, "done") else "done"
    pending_value = UploadStatus.pending.value if hasattr(UploadStatus, "pending") else "pending"

    if str(upload.status) == done_value:
        raise HTTPException(status_code=400, detail="Already processed")

    upload.status = pending_value
    upload.processor_job_id = None
    db.add(upload)
    db.commit()
    db.refresh(upload)

    # Decide which task to enqueue based on content_type
    try:
        base_ct = (upload.content_type or "").split(";", 1)[0].strip().lower()
        if base_ct in ("application/pdf", "text/plain"):
            async_result = extract_resume_text.delay(upload.id)
        else:
            async_result = transcribe_upload.delay(upload.id)
        upload.processor_job_id = async_result.id
        db.add(upload); db.commit(); db.refresh(upload)
    except Exception as exc:
        logger.exception("Retry enqueue failed: %s", exc)

    return upload


# =====================================================
# DELETE /upload/{id}  ✅ RETURN 200 JSON (for tests)
# =====================================================
@router.delete("/{upload_id:int}", response_model=dict)
def delete_upload(
    upload_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
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

    db.delete(upload)
    db.commit()

    try:
        if bucket and key:
            s3.delete_object(Bucket=bucket, Key=key)
    except Exception:
        pass  # don't break delete flow if storage fails

    return JSONResponse({"deleted": True}, status_code=200)
