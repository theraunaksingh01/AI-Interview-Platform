# backend/utils/audio_storage.py
import os
import logging
from pathlib import Path
from uuid import uuid4
from typing import Optional

logger = logging.getLogger(__name__)

BASE_DIR = Path(os.getcwd())
AGENT_AUDIO_DIR = BASE_DIR / "agent_audio"
AGENT_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# Public URL prefix that your FastAPI StaticFiles mount will serve from:
AUDIO_URL_PREFIX = "/media/agent_audio"

# Optional: limit files per interview to avoid disk explosion (0 = off)
FILES_PER_INTERVIEW_LIMIT = 50


def save_agent_audio_file(mp3_bytes: bytes, interview_id: Optional[str] = None) -> str:
    """
    Save mp3 bytes to a uniquely named file in agent_audio and return the URL path
    (e.g. "/media/agent_audio/<filename>.mp3").
    interview_id (optional) used for easier cleanup or grouping.
    """
    if not mp3_bytes:
        raise ValueError("Empty audio bytes")

    filename = f"agent_{uuid4().hex}.wav"
    out_path = AGENT_AUDIO_DIR / filename

    try:
        with open(out_path, "wb") as f:
            f.write(mp3_bytes)
    except Exception as e:
        logger.exception("Failed to save agent audio file: %s", e)
        raise

    # optional: simple cleanup policy (per interview). If interview_id provided, find files with that id substring.
    if interview_id and FILES_PER_INTERVIEW_LIMIT > 0:
        try:
            # naive: collect filenames containing interview_id; if too many, remove oldest
            files = sorted(
                [p for p in AGENT_AUDIO_DIR.iterdir() if p.is_file() and interview_id in p.name],
                key=lambda p: p.stat().st_mtime,
            )
            while len(files) > FILES_PER_INTERVIEW_LIMIT:
                to_rm = files.pop(0)
                try:
                    to_rm.unlink()
                except Exception:
                    logger.warning("Unable to remove old audio file %s", to_rm)
        except Exception:
            logger.exception("Error while enforcing files-per-interview limit")

    # Return path the frontend can request. Your StaticFiles mount should serve AUDIO_URL_PREFIX -> AGENT_AUDIO_DIR
    return f"/media/agent_audio/{filename}"

