from __future__ import annotations
import os, tempfile, subprocess
from sqlalchemy.orm import Session
from db.session import SessionLocal
from db.models import Upload, UploadStatus
from celery_app import app
from core.s3_client import get_s3_client
from core.config import settings
from faster_whisper import WhisperModel

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
_model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")

def _extract_wav_16k_mono(src_path: str) -> str:
    """
    Use ffmpeg to extract the audio track to 16k mono PCM WAV.
    Returns path to the wav file.
    """
    wav_fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(wav_fd)
    # ffmpeg command: input -> 16k mono wav
    cmd = [
        "ffmpeg",
        "-y",
        "-i", src_path,
        "-vn",                  # drop video
        "-acodec", "pcm_s16le",
        "-ac", "1",
        "-ar", "16000",
        wav_path,
    ]
    # run quietly
    completed = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if completed.returncode != 0 or not os.path.exists(wav_path) or os.path.getsize(wav_path) == 0:
        raise RuntimeError(f"ffmpeg failed: {completed.stderr.decode(errors='ignore')[:300]}")
    return wav_path

@app.task(name="tasks.transcribe_upload")
def transcribe_upload(upload_id: int) -> dict:
    db: Session = SessionLocal()
    try:
        upl = db.query(Upload).filter(Upload.id == upload_id).one_or_none()
        if not upl:
            return {"ok": False, "error": "upload not found", "upload_id": upload_id}

        # mark processing
        status_processing = getattr(UploadStatus, "processing", "processing")
        upl.status = status_processing.value if hasattr(status_processing, "value") else status_processing
        db.add(upl); db.commit(); db.refresh(upl)

        # download from S3
        s3 = get_s3_client()
        bucket = getattr(settings, "s3_bucket", None) or getattr(settings, "S3_BUCKET", None)
        if not bucket:
            raise RuntimeError("S3 bucket not configured")
        if not upl.key:
            raise RuntimeError("Upload.key is empty")

        # video temp
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            video_path = tmp.name
        s3.download_file(bucket, upl.key, video_path)

        # extract audio -> wav
        try:
            wav_path = _extract_wav_16k_mono(video_path)
        finally:
            try: os.remove(video_path)
            except Exception: pass

        # transcribe (turn off vad_filter to avoid empty-segment edge cases)
        try:
            segments, info = _model.transcribe(wav_path, vad_filter=False)
            text_parts = []
            for seg in segments:
                if seg and getattr(seg, "text", None):
                    text_parts.append(seg.text.strip())
            transcript = " ".join(text_parts).strip()
        finally:
            try: os.remove(wav_path)
            except Exception: pass

        # If no text, treat as empty transcript (not a hard error)
        if not transcript:
            transcript = ""

        upl.transcript = transcript
        status_done = getattr(UploadStatus, "done", "done")
        upl.status = status_done.value if hasattr(status_done, "value") else status_done
        db.add(upl); db.commit(); db.refresh(upl)

        return {"ok": True, "upload_id": upload_id, "status": upl.status, "preview": transcript[:200]}
    except Exception as e:
        # mark failed
        try:
            upl = db.query(Upload).filter(Upload.id == upload_id).one_or_none()
            if upl:
                status_failed = getattr(UploadStatus, "failed", "failed")
                upl.status = status_failed.value if hasattr(status_failed, "value") else status_failed
                db.add(upl); db.commit()
        except Exception:
            pass
        return {"ok": False, "upload_id": upload_id, "error": str(e)}
    finally:
        db.close()
