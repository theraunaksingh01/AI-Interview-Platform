from fastapi import APIRouter, UploadFile, File, Form
from uuid import UUID
from typing import List

from services.streaming_asr import append_audio, clear_stream

router = APIRouter(prefix="/api/interview", tags=["interview-audio"])


@router.post("/{interview_id}/transcribe_audio")
async def transcribe_audio(
    interview_id: UUID,
    file: UploadFile = File(...),
    question_id: int = Form(...),
):
    audio_bytes = await file.read()

    text, speech_ended = append_audio(
        str(interview_id),
        question_id,
        audio_bytes,
    )

    # Partial update
    if not speech_ended:
        return {
            "partial": True,
            "question_id": question_id,
            "text": text,
        }

    # Final flush
    clear_stream(str(interview_id), question_id)

    return {
        "partial": False,
        "question_id": question_id,
        "transcript": text,
    }

