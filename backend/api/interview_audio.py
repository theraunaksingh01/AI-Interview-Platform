# app/api/interview_audio.py

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from uuid import UUID
import os
import tempfile

from db.session import get_db
from sqlalchemy import text
from faster_whisper import WhisperModel

from services.streaming_asr import append_audio, clear_stream
from services.asr_service import transcribe_audio_bytes


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
    question_id: int = Form(...),
    partial: bool = Form(False),
):
    audio_bytes = await file.read()

    if partial:
        # 🔥 STREAMING MODE
        rolling_audio = append_audio(
            str(interview_id),
            question_id,
            audio_bytes,
        )

        transcript = transcribe_audio_bytes(rolling_audio)

        return {
            "transcript": transcript,
            "partial": True,
            "question_id": question_id,
        }

    # ✅ FINAL SUBMIT
    transcript = transcribe_audio_bytes(audio_bytes)

    clear_stream(str(interview_id), question_id)

    return {
        "transcript": transcript,
        "question_id": question_id,
        "partial": False,
    }
