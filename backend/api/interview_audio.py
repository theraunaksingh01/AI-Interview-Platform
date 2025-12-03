# app/api/interview_audio.py

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from uuid import UUID
import os
import tempfile

from db.session import get_db
from sqlalchemy import text
from faster_whisper import WhisperModel

asr_model = WhisperModel("base", device="cpu", compute_type="int8")


router = APIRouter(prefix="/api/interview", tags=["interview-audio"])


def transcribe_audio_bytes(audio_bytes: bytes) -> str:
    # On Windows, NamedTemporaryFile with delete=True keeps the file open
    # and ffmpeg/av can't reopen it -> PermissionError.
    fd, path = tempfile.mkstemp(suffix=".webm")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(audio_bytes)

        # Now the file is closed, Faster-Whisper/av can open it
        segments, info = asr_model.transcribe(path)

        transcript = " ".join(seg.text.strip() for seg in segments)
        return transcript.strip()
    finally:
        # best-effort cleanup
        try:
            os.remove(path)
        except OSError:
            pass


@router.post("/{interview_id}/transcribe_audio")
async def transcribe_audio(
    interview_id: UUID,
    file: UploadFile = File(...),
    question_id: int | None = Form(None),
    db: Session = Depends(get_db),
):
    # Basic validation: interview exists?
    row = db.execute(
        text("SELECT 1 FROM interviews WHERE id = :iid"),
        {"iid": interview_id},
    ).scalar()

    if row is None:
        raise HTTPException(status_code=404, detail="Interview not found")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # 🔊 Run ASR
    transcript = transcribe_audio_bytes(audio_bytes)

    # We DO NOT create InterviewTurn or trigger scoring here.
    # Frontend will send this transcript via WebSocket as `candidate_text`
    # so all the existing logic in interview_ws is reused.

    return {
        "transcript": transcript,
        "question_id": question_id,
    }
