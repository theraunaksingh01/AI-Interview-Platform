# backend/api/interview_audio.py

from fastapi import APIRouter, UploadFile, File, Form
from uuid import UUID

from services.streaming_asr import append_audio, clear_stream

router = APIRouter(prefix="/api/interview", tags=["interview-audio"])


@router.post("/{interview_id}/transcribe_audio")
async def transcribe_audio(
    interview_id: UUID,
    file: UploadFile = File(...),
    question_id: int = Form(...),
    partial: bool = Form(False),
):
    audio_bytes = await file.read()

    # 🔁 PARTIAL → ignore result for DB
    if partial:
        text, _ = append_audio(
            str(interview_id),
            question_id,
            audio_bytes,
        )
        return {
            "partial": True,
            "question_id": question_id,
            "text": text,  # optional debug
        }

    # 🟢 FINAL → commit transcript
    final_text, _ = append_audio(
        str(interview_id),
        question_id,
        audio_bytes,
    )

    clear_stream(str(interview_id), question_id)

   
    return {
        "partial": False,
        "question_id": question_id,
        "transcript": final_text,
    }
