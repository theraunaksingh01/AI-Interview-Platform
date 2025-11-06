# backend/api/transcribe.py
import os
import tempfile
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.session import get_db
from api.deps import get_current_user
from core.config import settings
from core.s3_client import get_s3_client
from models.responses import Responses
from faster_whisper import WhisperModel
from tasks.transcribe_response import transcribe_response as transcribe_task

router = APIRouter(prefix="/transcribe", tags=["transcription"])

# Load Whisper model once (CPU-friendly defaults)
WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "base")  # tiny|base|small|medium|large-v3
_model = WhisperModel(WHISPER_MODEL_NAME, device="cpu", compute_type="int8")


@router.post("/responses/{response_id}")
def transcribe_response(
    response_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Synchronous transcription for a given response_id.
    Downloads the recorded webm from S3/MinIO, runs Faster-Whisper,
    saves transcript back to DB.
    """
    resp: Responses | None = (
        db.query(Responses).filter(Responses.id == response_id).first()
    )
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found")
    if not resp.video_file_path:
        raise HTTPException(status_code=400, detail="video_file_path is empty")

    bucket = getattr(settings, "s3_bucket", None) or getattr(settings, "S3_BUCKET", None)
    if not bucket:
        raise HTTPException(status_code=500, detail="S3_BUCKET not configured")

    s3 = get_s3_client()

    # Download object to a temp file
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp_path = tmp.name
        try:
            s3.download_fileobj(bucket, resp.video_file_path, tmp)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"S3 download failed: {e}")

    try:
        # Transcribe with Faster-Whisper
        segments, info = _model.transcribe(tmp_path, vad_filter=True)
        transcript = " ".join((seg.text or "").strip() for seg in segments).strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    finally:
        # Clean up the temp file
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    # Persist transcript
    resp.transcript = transcript
    db.add(resp)
    db.commit()
    db.refresh(resp)

    return {
        "response_id": resp.id,
        "language": getattr(info, "language", None),
        "duration": getattr(info, "duration", None),
        "transcript_preview": transcript[:300] if transcript else "",
    }


@router.post("/responses/{response_id}/enqueue")
def enqueue_transcription(
    response_id: str,
    user=Depends(get_current_user),
):
    """
    Enqueue background transcription via Celery.
    """
    r = transcribe_task.delay(response_id)
    return {"queued": True, "task_id": r.id}
