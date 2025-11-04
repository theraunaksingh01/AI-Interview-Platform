# backend/tasks/transcribe.py
from __future__ import annotations
import time
from celery import shared_task
from sqlalchemy.orm import Session

from db.session import SessionLocal
from db.models import Upload
from db.models import UploadStatus  # enum with .pending/.processing/.done/.failed

@shared_task(name="tasks.transcribe_upload")
def transcribe_upload(upload_id: int) -> dict:
    """
    Minimal, deterministic worker:
    - sets status=processing
    - sleeps a bit to simulate work
    - writes a dummy transcript
    - sets status=done
    On any error, sets status=failed.
    """
    db: Session = SessionLocal()
    try:
        upl = db.query(Upload).filter(Upload.id == upload_id).one_or_none()
        if not upl:
            return {"ok": False, "error": "upload not found", "upload_id": upload_id}

        # 1) mark processing
        upl.status = UploadStatus.processing.value if hasattr(UploadStatus, "processing") else "processing"
        db.add(upl); db.commit(); db.refresh(upl)

        # 2) simulate processing (replace with real transcribe call)
        time.sleep(2)

        # 3) write a transcript and mark done
        demo_text = f"Demo transcript for {upl.filename} (id={upl.id}). Size={upl.size} bytes."
        setattr(upl, "transcript", demo_text)
        upl.status = UploadStatus.done.value if hasattr(UploadStatus, "done") else "done"
        db.add(upl); db.commit(); db.refresh(upl)

        return {"ok": True, "upload_id": upload_id, "status": upl.status}
    except Exception as e:
        # 4) on error, mark failed
        try:
            upl = db.query(Upload).filter(Upload.id == upload_id).one_or_none()
            if upl:
                upl.status = UploadStatus.failed.value if hasattr(UploadStatus, "failed") else "failed"
                db.add(upl); db.commit()
        except Exception:
            pass
        return {"ok": False, "upload_id": upload_id, "error": str(e)}
    finally:
        db.close()
