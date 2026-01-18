from fastapi import APIRouter, UploadFile, File, Form, Body, Depends, Query
from uuid import UUID
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List

from db.session import get_db
from models.interview_answers import InterviewAnswer

# 🔹 Live confidence signals
from services.live_signals import update_live_answer

# 🔹 WebSocket broadcast (NO import from ws_interview)
from services.ws_broadcast import broadcast_to_interview

# 🔹 WebM streaming (MediaRecorder)
from services.streaming_asr import (
    append_audio,
    pop_full_audio,
)

# 🔹 PCM streaming (WebAudio)
from services.pcm_buffer import (
    append_pcm,
    pop_full_pcm,
)

from services.asr_service import (
    transcribe_audio_bytes,
    transcribe_pcm_bytes,
)

from services.live_signals import get_final_confidence
from services.turn_reasoning import decide_turn_action
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

    # 🔁 Always buffer incoming chunks
    append_audio(str(interview_id), question_id, audio_bytes)

   # 🔁 PARTIAL → live confidence + adaptive follow-up
    if partial:
        signal = update_live_answer(
            str(interview_id),
            question_id,
            text,  # 
        )

        # 📡 Send live confidence to UI
        await broadcast_to_interview(
            interview_id,
            {
                "type": "live_signal",
                "question_id": question_id,
                "confidence": signal["confidence"],
                "word_count": signal["word_count"],
            },
        )

        # 🧠 Adaptive follow-up decision
        from services.live_followup import decide_followup

        followup = decide_followup(
            confidence=signal["confidence"],
            word_count=signal["word_count"],
            last_text=text,
        )

        if followup:
            await broadcast_to_interview(interview_id, followup)

        return {"partial": True, "question_id": question_id}



    # 🟢 FINAL → transcribe ONCE
    full_audio = pop_full_audio(str(interview_id), question_id)

    transcript = ""
    if full_audio:
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
        db.add(
            InterviewAnswer(
                interview_question_id=question_id,
                transcript=transcript,
            )
        )

    db.commit()

    # 🧠 Decide what the interviewer should do next (6D-15)
    final_confidence = get_final_confidence(
        str(interview_id),
        question_id,
    )

    decision = decide_turn_action(
        transcript=transcript,
        confidence=final_confidence,
    )

    # 📡 Notify frontend
    await broadcast_to_interview(
        interview_id,
        {
            "type": "turn_decision",
            "question_id": question_id,
            "decision": decision,
        },
    )

    print(
        f"[FINAL TRANSCRIPT][Q{question_id}] "
        f"confidence={final_confidence} decision={decision}"
    )

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
    question_id: int = Query(...),
    samples: List[int] = Body(...),
):
    pcm_bytes = bytearray()
    for s in samples:
        pcm_bytes += int(s).to_bytes(2, "little", signed=True)

    append_pcm(str(interview_id), question_id, bytes(pcm_bytes))
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

@router.post("/{interview_id}/live_text")
async def live_text(
    interview_id: UUID,
    question_id: int = Body(...),
    text: str = Body(...),
):
    """
    Receive live transcript text from browser ASR.
    Used ONLY for semantic drift + confidence.
    """

    signal = update_live_answer(
        str(interview_id),
        question_id,
        text,
    )

    # 🟢 Always broadcast live signal
    await broadcast_to_interview(
        str(interview_id),
        {
            "type": "live_signal",
            "question_id": question_id,
            "confidence": signal["confidence"],
            "word_count": signal["word_count"],
        },
    )

    # 🔴 Optional interrupt
    if signal.get("interrupt"):
        await broadcast_to_interview(
            str(interview_id),
            {
                "type": "ai_interrupt",
                "question_id": question_id,
                "text": signal.get("followup", "Can you stay on topic?"),
                "reason": signal.get("interrupt_reason", "semantic_drift"),
            },
        )

    return {"ok": True}
