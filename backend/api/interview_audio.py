#api/interview_audio.py
from collections import Counter
from fastapi import APIRouter, UploadFile, File, Form, Body, Depends, Query
from uuid import UUID
from sqlalchemy.orm import Session
from typing import List

from db.session import get_db
from models.interview_answers import InterviewAnswer

# 🔹 Timeline logging (6E-1)
from services.timeline_logger import log_timeline_event

# 🔹 Live confidence
from services.live_signals import update_live_answer, get_final_confidence

# 🔹 Turn reasoning (6D-15)
from services.turn_reasoning import decide_turn_action

# 🔹 WebSocket broadcast
from services.ws_broadcast import broadcast_to_interview

# 🔹 WebM streaming
from services.streaming_asr import append_audio, pop_full_audio

# 🔹 PCM streaming
from services.pcm_buffer import append_pcm, get_pcm_buffer, pop_full_pcm

# 🔹 ASR
from services.asr_service import transcribe_audio_bytes, transcribe_pcm_bytes


router = APIRouter(prefix="/api/interview", tags=["interview-audio"])


# ==========================================================
# 🎙️ MediaRecorder (WebM) — main answer pipeline
# ==========================================================

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

    # ------------------------------------------------------
    # PARTIAL chunks → NO Whisper, NO DB, NO reasoning
    # ------------------------------------------------------
    if partial:
        # partial_text = transcribe_audio_bytes(audio_bytes)
    
        # if partial_text:
        #     print("[LIVE TRANSCRIPT]", partial_text)
    
        #     signal = update_live_answer(
        #         str(interview_id),
        #         question_id,
        #         partial_text,
        #     )
    
        #     await broadcast_to_interview(
        #         interview_id,
        #         {
        #             "type": "live_signal",
        #             "question_id": question_id,
        #             "confidence": signal["confidence"],
        #             "word_count": signal["word_count"],
        #         },
        #     )
    
        #     if signal["interrupt"]:
        #         await broadcast_to_interview(
        #             interview_id,
        #             {
        #                 "type": "ai_interrupt",
        #                 "question_id": question_id,
        #                 "text": signal["followup"],
        #                 "reason": signal["interrupt_reason"],
        #             },
        #         )
    
        return {"partial": True}

    # ------------------------------------------------------
    # FINAL chunk → transcribe ONCE
    # ------------------------------------------------------
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

    # 🧾 Timeline: candidate answer
    log_timeline_event(
        db,
        interview_id=interview_id,
        question_id=question_id,
        event_type="candidate_answer",
        payload={"transcript": transcript},
    )

    # ------------------------------------------------------
    # 🧠 Turn-level reasoning (6D-15)
    # ------------------------------------------------------
    final_confidence = get_final_confidence(
        str(interview_id),
        question_id,
    )

    decision = decide_turn_action(
        transcript=transcript,
        confidence=final_confidence,
    )

    # 🧾 Timeline: turn decision
    log_timeline_event(
        db,
        interview_id=interview_id,
        question_id=question_id,
        event_type="turn_decision",
        payload={
            "decision": decision,
            "confidence": final_confidence,
        },
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
        f"[FINAL][Q{question_id}] "
        f"confidence={final_confidence} decision={decision}"
    )

    return {
        "partial": False,
        "question_id": question_id,
        "transcript": transcript,
    }


# ==========================================================
# 🔊 PCM STREAM (WebAudio API)
# ==========================================================
LIVE_TRANSCRIPTS = {}


def _is_hallucination(text: str) -> bool:
    """Detect Whisper hallucinations: a single word repeated > 50% of all tokens."""
    words = text.lower().split()
    if len(words) < 10:
        return False
    top_word, top_count = Counter(words).most_common(1)[0]
    return (top_count / len(words)) > 0.50


@router.post("/{interview_id}/stream_pcm")
async def stream_pcm_audio(
    interview_id: UUID,
    question_id: int = Query(...),
    samples: List[int] = Body(...),
):
    pcm_bytes = bytearray()

    for s in samples:
        pcm_bytes += int(s).to_bytes(2, "little", signed=True)

    pcm = bytes(pcm_bytes)

    append_pcm(str(interview_id), question_id, pcm)

    buffer_audio = get_pcm_buffer(str(interview_id), question_id)

    # Wait until ~5 seconds audio — short windows cause Whisper hallucinations
    if len(buffer_audio) < 160000:
        return {"ok": True}

    # Pop window instead of using full history
    window = pop_full_pcm(str(interview_id), question_id)

    partial_text = transcribe_pcm_bytes(window)

    # Discard hallucinated output (e.g. "but but but but..." or "oh oh oh oh...")
    if not partial_text or _is_hallucination(partial_text):
        return {"ok": True}

    print("[LIVE TRANSCRIPT]", partial_text)

    key = f"{interview_id}_{question_id}"
    prev = LIVE_TRANSCRIPTS.get(key, "")
    combined = (prev + " " + partial_text).strip()
    LIVE_TRANSCRIPTS[key] = combined

    signal = update_live_answer(
        str(interview_id),
        question_id,
        combined,
    )

    await broadcast_to_interview(
        interview_id,
        {
            "type": "live_signal",
            "question_id": question_id,
            "confidence": signal["confidence"],
            "word_count": signal["word_count"],
            "transcript": combined,
        },
    )

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

    print(f"[FINAL PCM][Q{question_id}] {transcript}")

    key = f"{interview_id}_{question_id}"
    LIVE_TRANSCRIPTS.pop(key, None)

    return {
        "question_id": question_id,
        "transcript": transcript,
    }


# ==========================================================
# 📝 Live text from Browser ASR (confidence only)
# ==========================================================

@router.post("/{interview_id}/live_text")
async def live_text(
    interview_id: UUID,
    question_id: int = Body(...),
    text: str = Body(...),
):
    signal = update_live_answer(
        str(interview_id),
        question_id,
        text,
    )

    # 🟢 Always send live signal
    await broadcast_to_interview(
        interview_id,
        {
            "type": "live_signal",
            "question_id": question_id,
            "confidence": signal["confidence"],
            "word_count": signal["word_count"],
        },
    )

    # 🔴 INTERRUPT IF NEEDED
    if signal["interrupt"]:
        await broadcast_to_interview(
            interview_id,
            {
                "type": "ai_interrupt",
                "question_id": question_id,
                "text": signal["followup"],
                "reason": signal["interrupt_reason"],
            },
        )

    return {"ok": True}
# ==========================================================