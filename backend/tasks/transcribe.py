# backend/tasks/transcribe.py
from __future__ import annotations
import time
from sqlalchemy.orm import Session
from db.session import SessionLocal
from db.models import Upload, UploadStatus
from celery_app import app  # ← import the app defined above

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

        # pretend to transcribe
        time.sleep(2)
        text = f"Demo transcript for {upl.filename} (id={upl.id})."
        upl.transcript = text

        # mark done
        status_done = getattr(UploadStatus, "done", "done")
        upl.status = status_done.value if hasattr(status_done, "value") else status_done
        db.add(upl); db.commit(); db.refresh(upl)

        return {"ok": True, "upload_id": upload_id, "status": upl.status}
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
