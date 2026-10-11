from __future__ import annotations
import os, tempfile
from sqlalchemy.orm import Session
from db.session import SessionLocal
from models.responses import Responses
from core.s3_client import get_s3_client
from services.whisper_loader import transcribe_audio
from celery_app import app



@app.task(name="tasks.transcribe_response")
def transcribe_response(response_id: str) -> dict:
    db: Session = SessionLocal()
    try:
        resp = db.query(Responses).filter(Responses.id == response_id).first()
        if not resp:
            return {"ok": False, "error": "response not found", "response_id": response_id}

        bucket = os.getenv("S3_BUCKET")
        if not bucket:
            return {"ok": False, "error": "S3_BUCKET env not set"}

        s3 = get_s3_client()
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp_path = tmp.name
            try:
                s3.download_fileobj(bucket, resp.video_file_path, tmp)
            except Exception as e:
                return {"ok": False, "error": f"S3 download failed: {e}"}

        try:
            segments, info = transcribe_audio(tmp_path)
            text = " ".join(seg.text.strip() for seg in segments).strip()
        except Exception as e:
            return {"ok": False, "error": f"Transcription failed: {e}"}
        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass

        resp.transcript = text
        db.add(resp); db.commit(); db.refresh(resp)
        return {"ok": True, "response_id": response_id, "preview": text[:200]}
    except Exception as e:
        return {"ok": False, "response_id": response_id, "error": str(e)}
    finally:
        db.close()
