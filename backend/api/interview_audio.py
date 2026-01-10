# backend/api/interview_audio.py
from fastapi import APIRouter, UploadFile, File, Form
from uuid import UUID
import os
import tempfile

from faster_whisper import WhisperModel

router = APIRouter(prefix="/api/interview", tags=["interview-audio"])

# ⚠️ IMPORTANT: int8 causes crashes on many Windows CPUs
asr_model = WhisperModel(
    "base",
    device="cpu",
    compute_type="float32",  # ← SAFE
)


def transcribe_audio_bytes(audio_bytes: bytes) -> str:
    fd, path = tempfile.mkstemp(suffix=".webm")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(audio_bytes)

        segments, _ = asr_model.transcribe(path)
        return " ".join(seg.text.strip() for seg in segments).strip()
    finally:
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

    # 🔥 Phase 6D-7: ignore partial chunks (UI-only)
    if partial:
        return {
            "partial": True,
            "question_id": question_id,
        }

    # ✅ FINAL SUBMIT ONLY
    transcript = transcribe_audio_bytes(audio_bytes)

    return {
        "transcript": transcript,
        "question_id": question_id,
        "partial": False,
    }
