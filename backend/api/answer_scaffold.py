# backend/api/answer_scaffold.py
#
# "Build Your Answer" — for students who know the content of an answer but
# struggle to produce it fluently in English under pressure. Breaks a weak
# answer into a sentence frame with short fill-in-the-blank prompts, lets
# the student speak each piece separately (low cognitive load per rep),
# then assembles and plays back the complete, correctly-structured answer.
#
# Max-tier only, same gating pattern as cheat_sheet.py.
#
# Reuses existing infrastructure:
#   - Same Whisper/ffmpeg transcription pipeline as topic_practice.py
#   - Same Claude Haiku pattern as cheat_sheet.py's reminder generation
#   - expected_answer_framework field already on the questions table —
#     generated here on first use and cached, so the existing Retry
#     feature benefits from it going forward too.

import json
import logging
import os
import subprocess
import tempfile

import anthropic
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.session import SessionLocal
from api.deps import get_current_user
from services.asr_service import model as _whisper
from api.rate_limit import transcribe_rate_limit_dep

log = logging.getLogger("api.answer_scaffold")

router = APIRouter(prefix="/api/answer-scaffold", tags=["answer_scaffold"])

ANSWER_SCAFFOLD_PLANS = {"max"}


def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_user_plan(db: Session, user_id: int) -> str:
    row = db.execute(
        text("SELECT plan FROM users WHERE id = :uid"), {"uid": user_id}
    ).scalar()
    return (row or "free").lower()


def _strip_json_fence(raw: str) -> str:
    text_ = raw.strip()
    if text_.startswith("```"):
        text_ = text_.split("```")[1]
        if text_.startswith("json"):
            text_ = text_[4:]
    return text_.strip()


def _require_max(db: Session, user_id: int):
    plan = _get_user_plan(db, user_id)
    if plan not in ANSWER_SCAFFOLD_PLANS:
        raise HTTPException(status_code=403, detail="answer_scaffold_requires_max")


# ── Eligibility check ────────────────────────────────────────────────────

class EligibilityRequest(BaseModel):
    answer_id: int


@router.post("/check-eligible")
def check_eligible(
    payload: EligibilityRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
):
    """
    Decide whether a given answer is a good candidate for scaffold practice:
    the transcript should show real content (not silence, not "I don't know")
    but score low on structure/coherence.
    """
    _require_max(db, current_user.id)

    row = db.execute(
        text("""
            SELECT ia.transcript, ia.score, ia.interview_question_id,
                   iq.question_text, iq.question_bank_id
            FROM interview_answers ia
            JOIN interview_questions iq ON iq.id = ia.interview_question_id
            WHERE ia.id = :aid AND ia.user_id = :uid
        """),
        {"aid": payload.answer_id, "uid": current_user.id},
    ).mappings().first()

    if not row:
        raise HTTPException(404, "Answer not found")

    transcript = (row["transcript"] or "").strip()
    word_count = len(transcript.split())

    if word_count < 8:
        return {"eligible": False, "reason": "not_enough_content"}

    if (row["score"] or 0) >= 6:
        return {"eligible": False, "reason": "score_already_good"}

    return {
        "eligible": True,
        "question_id": row["question_bank_id"],
        "question_text": row["question_text"],
    }


# ── Frame generation (cached on the questions table) ────────────────────

def _generate_and_cache_framework(db: Session, question_id: int, question_text: str) -> dict:
    """
    Generate a sentence-frame scaffold for this question via Claude, cache
    the readable frame on the questions table so future students hitting
    the same question (and the existing Retry feature) reuse it.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()

    fallback = {
        "frame_template": "The situation was [BLANK_1]. I [BLANK_2], and the result was [BLANK_3].",
        "blanks": [
            {"id": "BLANK_1", "prompt": "Briefly, what was happening?"},
            {"id": "BLANK_2", "prompt": "What did you do?"},
            {"id": "BLANK_3", "prompt": "What happened as a result?"},
        ],
    }

    if not api_key:
        result = fallback
    else:
        prompt = f"""A student is practicing for a job interview and struggled to
answer this question fluently in English, even though they understand the
content. Question: "{question_text}"

Create a sentence-frame scaffold to help them build a complete, well-structured
spoken answer, one small piece at a time. Break it into 3-5 short blanks the
student fills in by speaking a phrase (3-8 words each), not full sentences.

Return ONLY valid JSON in this exact shape, no markdown:
{{
  "frame_template": "I built [BLANK_1] to [BLANK_2]. The main challenge was [BLANK_3], and I solved it by [BLANK_4].",
  "blanks": [
    {{"id": "BLANK_1", "prompt": "What did you build? (just the name/type)"}},
    {{"id": "BLANK_2", "prompt": "What problem did it solve?"}},
    {{"id": "BLANK_3", "prompt": "What was the hardest part?"}},
    {{"id": "BLANK_4", "prompt": "What did you actually do about it?"}}
  ]
}}

The frame_template and blank prompts must genuinely fit THIS question - a
behavioral question needs a different shape than a technical explanation
question. Keep blank prompts short and concrete, in plain everyday English,
not academic phrasing. Do not use em dashes or curly quotes."""

        try:
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = ""
            for block in getattr(response, "content", []):
                if getattr(block, "type", "") == "text":
                    raw += getattr(block, "text", "")
            result = json.loads(_strip_json_fence(raw))
        except Exception as e:
            log.warning("[ANSWER_SCAFFOLD] Frame generation failed: %s", e)
            result = fallback

    try:
        db.execute(
            text("UPDATE questions SET expected_answer_framework = :fw WHERE id = :qid"),
            {"fw": result["frame_template"], "qid": question_id},
        )
        db.commit()
    except Exception as e:
        log.warning("[ANSWER_SCAFFOLD] Failed to cache framework: %s", e)
        db.rollback()

    return result


class GetScaffoldRequest(BaseModel):
    question_id: int
    question_text: str


@router.post("/get-scaffold")
def get_scaffold(
    payload: GetScaffoldRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
):
    """Return a sentence-frame scaffold for this question."""
    _require_max(db, current_user.id)
    scaffold = _generate_and_cache_framework(db, payload.question_id, payload.question_text)
    return scaffold


# ── Per-blank transcription ──────────────────────────────────────────────

@router.post("/transcribe-blank")
async def transcribe_blank(
    file: UploadFile = File(...),
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
    _rl=Depends(transcribe_rate_limit_dep),
):
    """Transcribe one short voice clip for a single blank. Same Whisper +
    ffmpeg pipeline as topic_practice.py's transcribe_audio, just called on
    much shorter clips."""
    _require_max(db, current_user.id)

    audio_bytes = await file.read()
    if not audio_bytes:
        return {"transcript": ""}

    suffix = ".webm" if "webm" in (file.content_type or "") else ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        wav_path = tmp_path + ".wav"
        cmd = [
            "ffmpeg", "-y", "-i", tmp_path,
            "-vn", "-acodec", "pcm_s16le",
            "-ac", "1", "-ar", "16000",
            wav_path,
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        target = wav_path if (result.returncode == 0 and os.path.exists(wav_path)) else tmp_path

        segments, _ = _whisper.transcribe(
            target,
            language="en",
            vad_filter=False,
            condition_on_previous_text=False,
            beam_size=2,
            initial_prompt="This is a short phrase from a technical job interview practice answer, possibly mentioning programming terms like equals, array, function, database, or system.",

        )
        transcript = " ".join(s.text.strip() for s in segments).strip()
        return {"transcript": transcript}
    except Exception as e:
        log.warning("[ANSWER_SCAFFOLD] Transcription failed: %s", e)
        return {"transcript": "", "error": str(e)}
    finally:
        for p in (tmp_path, tmp_path + ".wav"):
            try:
                os.unlink(p)
            except OSError:
                pass


# ── Assembly + light feedback ────────────────────────────────────────────

class AssembleRequest(BaseModel):
    frame_template: str
    filled_blanks: dict  # {"BLANK_1": "a library book system", ...}


@router.post("/assemble")
def assemble_answer(
    payload: AssembleRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
):
    """Fill the frame template with the student's spoken phrases and return
    the complete assembled answer, plus one short encouraging structural
    observation (not a score)."""
    _require_max(db, current_user.id)

    assembled = payload.frame_template
    for blank_id, phrase in payload.filled_blanks.items():
        assembled = assembled.replace(f"[{blank_id}]", phrase.strip())

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    feedback = "That's a complete, clearly structured answer. Try saying the whole thing out loud now, without the blanks."

    if api_key:
        try:
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=150,
                messages=[{
                    "role": "user",
                    "content": f"""A student just built this interview answer piece by piece:
"{assembled}"

Give ONE short, encouraging sentence (max 20 words) noting something specific
that works structurally about this answer - not a generic compliment, something
concrete about how the pieces connect. Return ONLY the sentence, no quotes, no
markdown, no preamble."""
                }],
            )
            raw = ""
            for block in getattr(response, "content", []):
                if getattr(block, "type", "") == "text":
                    raw += getattr(block, "text", "")
            if raw.strip():
                feedback = raw.strip()
        except Exception as e:
            log.warning("[ANSWER_SCAFFOLD] Feedback generation failed: %s", e)

    return {"assembled_answer": assembled, "feedback": feedback}