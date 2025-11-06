# backend/api/transcribe.py
import os, tempfile
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.session import get_db
from core.s3_client import get_s3_client
from models.responses import Responses
from faster_whisper import WhisperModel
from tasks.transcribe_response import transcribe_response as transcribe_task


router = APIRouter(prefix="/transcribe", tags=["transcription"])

# Load once (CPU)
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")  # tiny|base|small|medium|large-v3
_model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")

@router.post("/responses/{response_id}")
def transcribe_response(response_id: str, db: Session = Depends(get_db)):
    resp = db.query(Responses).filter(Responses.id == response_id).first()
    if not resp:
        raise HTTPException(404, "Response not found")
    if not resp.video_file_path:
        raise HTTPException(400, "video_file_path is empty")

    bucket = os.getenv("S3_BUCKET")
    if not bucket:
        raise HTTPException(500, "S3_BUCKET env not set")

    s3 = get_s3_client()
    # download to temp
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp_path = tmp.name
        try:
            s3.download_fileobj(bucket, resp.video_file_path, tmp)
        except Exception as e:
            raise HTTPException(500, f"S3 download failed: {e}")

    try:
        # Faster-Whisper streaming decode
        segments, info = _model.transcribe(tmp_path, vad_filter=True)
        text_parts = []
        for seg in segments:
            text_parts.append(seg.text)
        transcript = " ".join(t.strip() for t in text_parts).strip()
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {e}")
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    resp.transcript = transcript
    db.add(resp)
    db.commit()
    db.refresh(resp)

    return {
        "response_id": resp.id,
        "language": getattr(info, "language", None),
        "duration": getattr(info, "duration", None),
        "transcript_preview": transcript[:300]
    }
    
@router.post("/responses/{response_id}/enqueue")
def enqueue_transcription(response_id: str):
    r = transcribe_task.delay(response_id)
    return {"queued": True, "task_id": r.id}
