#api/interview_audio.py
from collections import Counter
from fastapi import APIRouter, UploadFile, File, Form, Body, Depends, Query
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text
from typing import List
import asyncio
import logging

from db.session import get_db
from models.interview_answers import InterviewAnswer

# 🔹 Timeline logging (6E-1)
from services.timeline_logger import log_timeline_event

# 🔹 Live confidence
from services.live_signals import update_live_answer, get_final_confidence, clear_live_state

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
from services.tts_service import synthesize_speech
from utils.audio_storage import save_agent_audio_file


router = APIRouter(prefix="/api/interview", tags=["interview-audio"])
logger = logging.getLogger(__name__)


def _get_question_text(db: Session, interview_id: UUID, question_id: int) -> str:
    row = db.execute(
        sql_text(
            """
            SELECT question_text
            FROM interview_questions
            WHERE id = :qid
            LIMIT 1
            """
        ),
        {"qid": question_id},
    ).fetchone()
    if not row:
        return ""
    return str(row[0] or "")


async def _build_interrupt_payload(
    interview_id: UUID,
    question_id: int,
    interrupt_text: str,
    reason: str,
) -> dict:
    """Build text-only interrupt payload. TTS audio is sent separately via background task."""
    return {
        "type": "ai_interrupt",
        "question_id": question_id,
        "text": interrupt_text,
        "reason": reason,
    }


async def _send_interrupt_audio(interview_id: UUID, interrupt_text: str):
    """Background task: synthesize TTS and broadcast audio follow-up."""
    try:
        audio_bytes = await asyncio.to_thread(synthesize_speech, interrupt_text)
        if audio_bytes:
            audio_url = await asyncio.to_thread(
                save_agent_audio_file,
                audio_bytes,
                str(interview_id),
            )
            await broadcast_to_interview(
                interview_id,
                {"type": "ai_interrupt_audio", "audio_url": audio_url},
            )
    except Exception:
        logger.exception("[TTS] interrupt audio synthesis failed")


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

    clear_live_state(str(interview_id), question_id)

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
    db: Session = Depends(get_db),
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

    question_text = _get_question_text(db, interview_id, question_id)

    signal = update_live_answer(
        str(interview_id),
        question_id,
        combined,
        question_text=question_text,
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

    if signal["interrupt"]:
        payload = await _build_interrupt_payload(
            interview_id=interview_id,
            question_id=question_id,
            interrupt_text=signal["followup"],
            reason=signal["interrupt_reason"],
        )
        await broadcast_to_interview(
            interview_id,
            payload,
        )
        # Fire TTS audio in background — don't block the interrupt text
        asyncio.create_task(_send_interrupt_audio(interview_id, signal["followup"]))

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
    clear_live_state(str(interview_id), question_id)

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
    db: Session = Depends(get_db),
):
    question_text = _get_question_text(db, interview_id, question_id)

    signal = update_live_answer(
        str(interview_id),
        question_id,
        text,
        question_text=question_text,
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
        payload = await _build_interrupt_payload(
            interview_id=interview_id,
            question_id=question_id,
            interrupt_text=signal["followup"],
            reason=signal["interrupt_reason"],
        )
        await broadcast_to_interview(
            interview_id,
            payload,
        )
        # Fire TTS audio in background — don't block the interrupt text
        asyncio.create_task(_send_interrupt_audio(interview_id, signal["followup"]))

    return {"ok": True}
# ==========================================================