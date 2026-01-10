from fastapi import APIRouter, Body
from uuid import UUID
from typing import List

from services.streaming_asr import append_audio, clear_stream

router = APIRouter(prefix="/api/interview", tags=["interview-audio"])


@router.post("/{interview_id}/transcribe_audio")
async def transcribe_audio(
    interview_id: UUID,
    question_id: int = Body(...),
    audio_bytes: List[int] = Body(...),
    partial: bool = Body(True),
):
    """
    Streaming ASR endpoint.
    Expects raw PCM/WEBM bytes sent as JSON array.
    """

    # Convert list[int] → bytes
    chunk = bytes(audio_bytes)

    text = append_audio(str(interview_id), question_id, chunk)

    if partial:
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
