# api/uploads_proxy.py
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import uuid
from datetime import datetime

from api.deps import get_current_user, get_db
from core.s3_client import get_s3_client
from core.config import settings
from db import models
from tasks.transcribe import transcribe_upload

router = APIRouter(prefix="/upload", tags=["upload_proxy"])

@router.post("/proxy")
async def upload_proxy(
    file: UploadFile = File(...),
    folder: str | None = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Proxy upload: client posts file to this endpoint (multipart/form-data).
    Backend uploads file to S3/MinIO and returns the object key and metadata.
    """
    s3 = get_s3_client()
    bucket = settings.S3_BUCKET
    if not bucket:
        raise HTTPException(status_code=500, detail="S3 bucket not configured")

    folder_prefix = (folder.strip("/") + "/") if folder else ""
    unique_id = uuid.uuid4().hex
    safe_name = file.filename.replace(" ", "_")
    key = f"{folder_prefix}{datetime.utcnow().strftime('%Y%m%d')}/{unique_id}_{safe_name}"

    # Attempt upload
    try:
        file.file.seek(0)
        s3.upload_fileobj(
            Fileobj=file.file,
            Bucket=bucket,
            Key=key,
            ExtraArgs={"ContentType": file.content_type or "application/octet-stream"},
        )

        # Try to determine uploaded object size: prefer file.file if available
        size = None
        try:
            pos = file.file.tell()
            # seek to end to get size (works for SpooledTemporaryFile)
            file.file.seek(0, 2)
            size = file.file.tell()
            # restore pointer
            try:
                file.file.seek(pos)
            except Exception:
                pass
        except Exception:
            size = None

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"upload failed: {exc}")
    finally:
        try:
            file.file.close()
        except Exception:
            pass

    # Persist upload metadata in DB
    try:
        upload = models.Upload(
            user_id=current_user.id,
            key=key,
            filename=file.filename,
            content_type=file.content_type,
            size=size,
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)
        # Enqueue background job to process the upload
        async_result = transcribe_upload.delay(upload.id)
        upload.processor_job_id = async_result.id
        db.add(upload)
        db.commit()
        db.refresh(upload)
    except Exception as e:
        # If DB persist fails, we still return successful S3 result but log and return 500 if you want strictness
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB save failed: {e}")

    return JSONResponse({
        "id": upload.id,
        "key": upload.key,
        "filename": upload.filename,
        "content_type": upload.content_type,
        "size": upload.size,
        "created_at": upload.created_at.isoformat(),
        "status": upload.status,
        "processor_job_id": upload.processor_job_id,
    })
