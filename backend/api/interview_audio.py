# api/interview_audio.py

from signal import signal

from fastapi import APIRouter, UploadFile, File, Form, Body, Depends, Query
from uuid import UUID
from sqlalchemy.orm import Session
from typing import List
import json
from sqlalchemy import text

from db.session import get_db
from models.interview_answers import InterviewAnswer

# 🔹 Timeline logging
from services.timeline_logger import log_timeline_event

# 🔹 Live confidence
from services.live_signals import update_live_answer, get_final_confidence, clear_live_state

# 🔹 Turn reasoning
from services.turn_reasoning import decide_turn_action

# 🔹 WebSocket broadcast
from services.ws_broadcast import broadcast_to_interview

# 🔹 WebM streaming
from services.streaming_asr import append_audio, pop_full_audio

# 🔹 PCM streaming
from services.pcm_buffer import (
    append_pcm,
    get_pcm_buffer,
    pop_full_pcm,
    should_trigger_partial_eval,
)

#  ASR
from services.asr_service import transcribe_audio_bytes, transcribe_pcm_bytes

#  Evaluator
from services.semantic_evaluator import evaluate_answer

# llm judge
from services.live_llm_judge import judge_live_answer
from sqlalchemy import text

import asyncio
import numpy as np
from services.tts_service import synthesize_speech
from utils.audio_storage import save_agent_audio_file


import logging

logger = logging.getLogger(__name__)

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

    append_audio(str(interview_id), question_id, audio_bytes)
    
    print(">>> HIT transcribe_audio")
    print(">>> partial:", partial)

    if partial:
        return {"partial": True, "question_id": question_id}

    full_audio = pop_full_audio(str(interview_id), question_id)

    transcript = ""
    if full_audio:
        transcript = transcribe_audio_bytes(full_audio)

    # ------------------------------------------------------
    # Save transcript
    # ------------------------------------------------------

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

    # ------------------------------------------------------
    # Timeline: candidate answer
    # ------------------------------------------------------

    log_timeline_event(
        db,
        interview_id=interview_id,
        question_id=question_id,
        event_type="candidate_answer",
        payload={"transcript": transcript},
    )

    # ======================================================
    # 🧠 Phase 7.2 — LLM Rubric Evaluation (RAW SQL SAFE)
    # ======================================================

    # Fetch role title
    role_row = db.execute(
        text("""
            SELECT r.title
FROM interviews i
LEFT JOIN roles r ON r.id = i.role_id
WHERE i.id = :iid
LIMIT 1

        """),
        {"iid": str(interview_id)}
    ).scalar()

    role_title = role_row or "Technical Role"

    # Fetch question text
    question_row = db.execute(
        text("""
            SELECT question_text
            FROM interview_questions
            WHERE id = :qid
            LIMIT 1
        """),
        {"qid": question_id}
    ).scalar()

    question_text = question_row or ""

    # Run evaluator
    evaluation = evaluate_answer(
        role_title=role_title,
        question=question_text,
        transcript=transcript,
    )

    # Update interview_answers
    db.execute(
        text("""
            UPDATE interview_answers
            SET rubric_scores = CAST(:rubric AS jsonb),
                overall_score = :overall,
                strengths = CAST(:strengths AS jsonb),
                weaknesses = CAST(:weaknesses AS jsonb)
            WHERE interview_question_id = :qid
        """),
        {
            "rubric": json.dumps(evaluation.get("rubric_scores")),
            "overall": evaluation.get("overall_score"),
            "strengths": json.dumps(evaluation.get("strengths")),
            "weaknesses": json.dumps(evaluation.get("weaknesses")),
            "qid": question_id,
        },
    )

    db.commit()

    # Timeline log
    log_timeline_event(
        db,
        interview_id=interview_id,
        question_id=question_id,
        event_type="semantic_evaluation",
        payload=evaluation,
    )

    # Broadcast semantic result
    await broadcast_to_interview(
        interview_id,
        {
            "type": "semantic_result",
            "question_id": question_id,
            "evaluation": evaluation,
        },
    )

    # ------------------------------------------------------
    # 🧠 Turn-level reasoning
    # ------------------------------------------------------

    final_confidence = get_final_confidence(
        str(interview_id),
        question_id,
    )

    decision = decide_turn_action(
        transcript=transcript,
        confidence=final_confidence,
    )

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
    
    print("FINAL CHUNK RECEIVED")
    print("Audio bytes size:", len(full_audio) if full_audio else 0)
    print("Transcript result:", transcript)

    return {
        "partial": False,
        "question_id": question_id,
        "transcript": transcript,
    }


# ==========================================================
# 🔊 PCM STREAM (WebAudio API)
# ==========================================================

@router.post("/{interview_id}/stream_pcm")
async def stream_pcm_audio(
    interview_id: UUID,
    question_id: int = Query(...),
    samples: List[int] = Body(...),
    sample_rate: int = Query(16000),
    db: Session = Depends(get_db)
):
    # ----------------------------
    # Convert samples → 16kHz PCM Int16 LE (resample if needed)
    # Chrome sends 48kHz; backend must resample to 16kHz for Whisper
    # ----------------------------
    if not samples:
        return {"ok": True}

    pcm_array = np.asarray(samples, dtype=np.int16)
    sr = max(8000, min(192000, int(sample_rate)))  # clamp to sane range

    if sr != 16000:
        duration_sec = len(pcm_array) / float(sr)
        target_len = int(round(duration_sec * 16000))
        if target_len > 0:
            t_src = np.linspace(0, duration_sec, num=len(pcm_array), endpoint=False, dtype=np.float64)
            t_dst = np.linspace(0, duration_sec, num=target_len, endpoint=False, dtype=np.float64)
            src_f = pcm_array.astype(np.float64)
            resampled = np.interp(t_dst, t_src, src_f)
            pcm_array = np.clip(resampled, -32768, 32767).astype(np.int16)

    pcm_bytes = pcm_array.tobytes()

    # ----------------------------
    # Append to rolling buffer
    # ----------------------------
    append_pcm(str(interview_id), question_id, pcm_bytes)

    # ----------------------------
    # 🔥 PARTIAL EVALUATION 
    # ----------------------------
    if should_trigger_partial_eval(str(interview_id), question_id):

       
        buffer_audio = get_pcm_buffer(str(interview_id), question_id)

        # require at least ~2 seconds audio
        if len(buffer_audio) < 64000:
            return {"ok": True}
        
        partial_text = transcribe_pcm_bytes(buffer_audio)
        
        print("[PARTIAL TEXT]", partial_text)

        if not partial_text.strip():
            return {"ok": True}

        signal = update_live_answer(
            str(interview_id),
            question_id,
            partial_text,
        )
        
        await broadcast_to_interview(
            interview_id,
            {
                "type": "live_transcript",
                "text": partial_text,
                "question_id": question_id
            },
        )

        # ----------------------------
        # Always send confidence
        # ----------------------------
        await broadcast_to_interview(
            interview_id,
            {
                "type": "live_signal",
                "question_id": question_id,
                "confidence": signal["confidence"],
                "word_count": signal["word_count"],
            },
        )

        # ----------------------------
        # Send interrupt if triggered
        # ----------------------------
        interrupt_decision = signal.get("interrupt")
        followup_text = signal.get("followup")
        reason = signal.get("interrupt_reason")

        # 🔥 HYBRID LAYER
        if not interrupt_decision and signal["confidence"] != "high":
        
            # fetch question text
            row = db.execute(
                text("""
                    SELECT question_text
                    FROM interview_questions
                    WHERE id = :qid
                """),
                {"qid": question_id},
            ).fetchone()

            question_text = row.question_text if row else ""

            llm_result = judge_live_answer(question_text, partial_text)

            if llm_result.get("interrupt"):
                interrupt_decision = True
                followup_text = llm_result.get("followup")
                reason = llm_result.get("reason")

        # 🔴 Final interrupt

        if interrupt_decision:

            if not followup_text:
                followup_text = signal.get("followup")
        
            if not reason:
                reason = signal.get("interrupt_reason")

            audio_url = None

            # Generate TTS audio safely
            try:
                audio_bytes = await asyncio.to_thread(
                    synthesize_speech,
                    followup_text
                )

                if audio_bytes:
                    audio_url = await asyncio.to_thread(
                        save_agent_audio_file,
                        audio_bytes,
                        str(interview_id)
                    )

            except Exception as e:
                logger.exception("[TTS interrupt failed]")

            await broadcast_to_interview(
                interview_id,
                {
                    "type": "ai_interrupt",
                    "question_id": question_id,
                    "text": followup_text,
                    "reason": reason,
                    "audio_url": audio_url,
                },
            )
    
    return {"ok": True}


@router.post("/{interview_id}/finalize_pcm")
async def finalize_pcm(
    interview_id: UUID,
    question_id: int = Query(...),
    db: Session = Depends(get_db),
):
    # 🔒 Check if already finalized
    existing = db.execute(
        text("""
            SELECT transcript
            FROM interview_answers
            WHERE interview_question_id = :qid
            ORDER BY id DESC
            LIMIT 1
        """),
        {"qid": question_id}
    ).scalar()

    if existing:
        print("⚠️ Duplicate finalize ignored")
        return {"ok": True, "duplicate": True}

    pcm = pop_full_pcm(str(interview_id), question_id)
    
    clear_live_state(str(interview_id), question_id)

    transcript = ""
    if pcm:
        transcript = transcribe_pcm_bytes(pcm)

    print(f"[FINAL PCM][Q{question_id}] {transcript}")

    db.execute(
        text("""
            INSERT INTO interview_answers
            (interview_question_id, transcript)
            VALUES (:qid, :transcript)
        """),
        {"qid": question_id, "transcript": transcript}
    )
    db.commit()

    return {"question_id": question_id, "transcript": transcript}




# ==========================================================
# 📝 Live text from Browser ASR
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
    
    print("[LIVE TEXT]", signal)

    await broadcast_to_interview(
        interview_id,
        {
            "type": "live_signal",
            "question_id": question_id,
            "confidence": signal["confidence"],
            "word_count": signal["word_count"],
        },
    )

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