#api/interview_audio.py
from collections import Counter
from fastapi import APIRouter, UploadFile, File, Form, Body, Depends, Query
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text
from typing import List
import asyncio
import logging
import json

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
from services.asr_service import (
    transcribe_audio_bytes_with_segments,
    transcribe_pcm_bytes,
    transcribe_pcm_with_vad_result,
)
from services.tts_service import synthesize_speech
from utils.audio_storage import save_agent_audio_file
from services.interview_runtime_state import get_interview_state


router = APIRouter(prefix="/api/interview", tags=["interview-audio"])
logger = logging.getLogger(__name__)


CODING_LIKE_QUESTION_TYPES = {"code", "coding", "dsa", "system_design", "system-design"}


def _normalize_question_type(question_type: str | None) -> str:
    return (question_type or "").strip().lower().replace("-", "_")


def _is_coding_like_question_type(question_type: str | None) -> bool:
    return _normalize_question_type(question_type) in {qt.replace("-", "_") for qt in CODING_LIKE_QUESTION_TYPES}


def _get_question_type(db: Session, question_id: int) -> str:
    row = db.execute(
        sql_text(
            """
            SELECT type
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
    logger.info("transcribe_audio entry: interview=%s question=%s partial=%s", interview_id, question_id, partial)
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
    whisper_segments = []
    if full_audio:
        asr_result = transcribe_audio_bytes_with_segments(full_audio)
        transcript = str(asr_result.get("transcript") or "")
        whisper_segments = asr_result.get("segments") or []

    # 🔒 Persist transcript
    answer = (
        db.query(InterviewAnswer)
        .filter(InterviewAnswer.interview_question_id == question_id)
        .first()
    )

    current_answer_id = None
    if answer:
        answer.transcript = transcript
        current_answer_id = int(answer.id)
    else:
        new_answer = InterviewAnswer(
            interview_question_id=question_id,
            transcript=transcript,
        )
        db.add(new_answer)
        db.flush()
        current_answer_id = int(new_answer.id)

    # Capture D4/D6 inputs from Whisper segments and transcript.
    try:
        time_to_first_word = None
        if whisper_segments:
            time_to_first_word = float(whisper_segments[0].get("start") or 0.0)

        silence_gaps = []
        for i in range(len(whisper_segments) - 1):
            curr_end = float(whisper_segments[i].get("end") or 0.0)
            next_start = float(whisper_segments[i + 1].get("start") or 0.0)
            gap = next_start - curr_end
            if gap > 1.0:
                silence_gaps.append(
                    {
                        "start": curr_end,
                        "end": next_start,
                        "duration": gap,
                    }
                )

        answer_word_count = len((transcript or "").split())

        if current_answer_id is not None:
            logger.info(
                "D4/D5/D6 save: answer_id=%s ttfw=%s wc=%s",
                current_answer_id,
                time_to_first_word,
                answer_word_count,
            )
            db.execute(
                sql_text(
                    """
                    UPDATE interview_answers
                    SET
                        time_to_first_word = :ttfw,
                        silence_gaps = CAST(:gaps AS jsonb),
                        answer_word_count = :wc
                    WHERE id = :aid
                    """
                ),
                {
                    "ttfw": time_to_first_word,
                    "gaps": json.dumps(silence_gaps),
                    "wc": int(answer_word_count),
                    "aid": int(current_answer_id),
                },
            )
            logger.info("Saved D4/D5/D6 for answer %s", current_answer_id)
        else:
            logger.warning("D4/D5/D6 skipped: answer_id unresolved for question=%s", question_id)
    except Exception:
        logger.exception("[ASR_CAPTURE] failed to persist timing/silence metadata for qid=%s", question_id)

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
    state = get_interview_state(interview_id)
    if state.get("answer_submitted", False):
        clear_live_state(str(interview_id), question_id)
        return {"ok": True, "interrupts_skipped": True}

    active_question_id = state.get("active_question_id")
    if active_question_id is not None and int(active_question_id) != int(question_id):
        clear_live_state(str(interview_id), question_id)
        return {"ok": True, "interrupts_skipped": True}

    question_type = _get_question_type(db, question_id)
    if _is_coding_like_question_type(question_type):
        clear_live_state(str(interview_id), question_id)
        return {"ok": True, "interrupts_skipped": True}

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

    vad_result = transcribe_pcm_with_vad_result(window)
    partial_text = vad_result["transcript"]

    await broadcast_to_interview(
        interview_id,
        {
            "type": "vad_result",
            "question_id": question_id,
            "is_silence": bool(vad_result["is_silence"]),
            "transcript": partial_text,
        },
    )

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
    db: Session = Depends(get_db),
):
    pcm = pop_full_pcm(str(interview_id), question_id)
    transcript = ""
    whisper_segments = []
    if pcm:
        asr_result = transcribe_audio_bytes_with_segments(pcm)
        transcript = str(asr_result.get("transcript") or "")
        whisper_segments = asr_result.get("segments") or []

    print(f"[FINAL PCM][Q{question_id}] {transcript}")
    key = f"{interview_id}_{question_id}"
    LIVE_TRANSCRIPTS.pop(key, None)
    clear_live_state(str(interview_id), question_id)

    # Save transcript + D4/D5/D6 to interview_answers
    try:
        answer = (
            db.query(InterviewAnswer)
            .filter(InterviewAnswer.interview_question_id == question_id)
            .first()
        )
        if answer:
            answer.transcript = transcript
            current_answer_id = int(answer.id)
        else:
            new_answer = InterviewAnswer(
                interview_question_id=question_id,
                transcript=transcript,
            )
            db.add(new_answer)
            db.flush()
            current_answer_id = int(new_answer.id)

        # D4/D5/D6 capture
        time_to_first_word = None
        if whisper_segments:
            time_to_first_word = float(whisper_segments[0].get("start") or 0.0)
        silence_gaps = []
        for i in range(len(whisper_segments) - 1):
            curr_end = float(whisper_segments[i].get("end") or 0.0)
            next_start = float(whisper_segments[i + 1].get("start") or 0.0)
            gap = next_start - curr_end
            if gap > 1.0:
                silence_gaps.append({"start": curr_end, "end": next_start, "duration": gap})
        answer_word_count = len(transcript.split())

        db.execute(
            sql_text("""
                UPDATE interview_answers
                SET time_to_first_word = :ttfw,
                    silence_gaps = CAST(:gaps AS jsonb),
                    answer_word_count = :wc
                WHERE id = :aid
            """),
            {
                "ttfw": time_to_first_word,
                "gaps": json.dumps(silence_gaps),
                "wc": answer_word_count,
                "aid": current_answer_id,
            },
        )
        db.commit()
        logger.info("finalize_pcm saved D4/D5/D6 for answer %s ttfw=%s wc=%s",
                    current_answer_id, time_to_first_word, answer_word_count)
    except Exception:
        logger.exception("[finalize_pcm] failed to save transcript/D4/D5/D6 for q=%s", question_id)
        try:
            db.rollback()
        except Exception:
            pass

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
    state = get_interview_state(interview_id)
    if state.get("answer_submitted", False):
        clear_live_state(str(interview_id), question_id)
        return {"ok": True, "interrupts_skipped": True}

    active_question_id = state.get("active_question_id")
    if active_question_id is not None and int(active_question_id) != int(question_id):
        clear_live_state(str(interview_id), question_id)
        return {"ok": True, "interrupts_skipped": True}

    question_type = _get_question_type(db, question_id)
    if _is_coding_like_question_type(question_type):
        clear_live_state(str(interview_id), question_id)
        return {"ok": True, "interrupts_skipped": True}

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