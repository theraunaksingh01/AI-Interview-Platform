from fastapi import APIRouter, UploadFile, File, Form, Body, Depends
from uuid import UUID
from sqlalchemy.orm import Session
from typing import List

from db.session import get_db
from models.interview_answers import InterviewAnswer

from services.streaming_asr import (
    append_audio,
    pop_full_audio,
    append_pcm_audio,
    pop_full_pcm,
)

from services.asr_service import (
    transcribe_audio_bytes,
    transcribe_pcm_bytes,
)

from services.ws_broadcast import broadcast_to_interview


router = APIRouter(prefix="/api/interview", tags=["interview-audio"])


# ===============================
# 🎙️ WEBM AUDIO (MediaRecorder)
# ===============================

@router.post("/{interview_id}/transcribe_audio")
async def transcribe_audio(
    interview_id: UUID,
    file: UploadFile = File(...),
    question_id: int = Form(...),
    partial: bool = Form(False),
    db: Session = Depends(get_db),
):
    audio_bytes = await file.read()

    # 🔁 Always buffer chunks
    append_audio(str(interview_id), question_id, audio_bytes)

    # 🔁 Partial chunks → no Whisper, no DB
    if partial:
        return {"partial": True, "question_id": question_id}

    # 🟢 FINAL → pop + transcribe ONCE
    full_audio = pop_full_audio(str(interview_id), question_id)

    transcript = ""
    if full_audio:
        transcript = transcribe_audio_bytes(full_audio)

    # 🔒 Persist transcript (idempotent)
    answer = (
        db.query(InterviewAnswer)
        .filter(InterviewAnswer.interview_question_id == question_id)
        .first()
    )

    if answer:
        answer.transcript = transcript
    else:
        answer = InterviewAnswer(
            interview_question_id=question_id,
            transcript=transcript,
        )
        db.add(answer)

    db.commit()

    print(f"[FINAL TRANSCRIPT][Q{question_id}] {transcript}")

    return {
        "partial": False,
        "question_id": question_id,
        "transcript": transcript,
    }


# ===============================
# 🔊 PCM STREAM (WebAudio API)
# ===============================

@router.post("/{interview_id}/stream_pcm")
async def stream_pcm_audio(
    interview_id: UUID,
    question_id: int,
    samples: List[int] = Body(...),
):
    """
    Receive PCM Int16 samples from browser.
    """
    pcm_bytes = bytearray()
    for s in samples:
        pcm_bytes += int(s).to_bytes(2, byteorder="little", signed=True)

    append_pcm_audio(str(interview_id), question_id, bytes(pcm_bytes))
    return {"ok": True}


@router.post("/{interview_id}/finalize_pcm")
async def finalize_pcm(
    interview_id: UUID,
    question_id: int,
):
    pcm = pop_full_pcm(str(interview_id), question_id)

    transcript = ""
    if pcm:
        transcript = transcribe_pcm_bytes(pcm)

    print(f"[FINAL PCM TRANSCRIPT][Q{question_id}] {transcript}")

    return {
        "question_id": question_id,
        "transcript": transcript,
    }
