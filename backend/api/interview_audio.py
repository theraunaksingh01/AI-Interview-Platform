from fastapi import APIRouter, UploadFile, File, Form, Depends
from uuid import UUID
from sqlalchemy.orm import Session

from db.session import get_db
from models.interview_answers import InterviewAnswer
from services.streaming_asr import append_audio, pop_full_audio
from services.asr_service import transcribe_audio_bytes

router = APIRouter(prefix="/api/interview", tags=["interview-audio"])


@router.post("/{interview_id}/transcribe_audio")
async def transcribe_audio(
    interview_id: UUID,
    file: UploadFile = File(...),
    question_id: int = Form(...),
    partial: bool = Form(False),
    db: Session = Depends(get_db),
):
    audio_bytes = await file.read()

    # 🔁 Always buffer
    append_audio(str(interview_id), question_id, audio_bytes)

    # 🔁 Partial chunks: no Whisper
    if partial:
        return {
            "partial": True,
            "question_id": question_id,
        }

    # 🟢 FINAL: pop + transcribe once
    full_audio = pop_full_audio(str(interview_id), question_id)
    transcript = transcribe_audio_bytes(full_audio)

    # 🔒 Persist transcript
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
