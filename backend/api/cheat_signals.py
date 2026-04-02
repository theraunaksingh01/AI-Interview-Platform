"""
API endpoint for anti-cheat signal submission and processing
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any
from datetime import datetime
from pydantic import BaseModel

from db.session import get_db
from models.cheat_signal import CheatSignal
from models.interview_answers import InterviewAnswer
from services.cheat_scorer import cheat_scorer


router = APIRouter(prefix="/api/interview", tags=["anti-cheat"])


def score_answer_from_flags(db: Session, answer_id: int, flags: List[str]) -> Dict[str, Any]:
    """
    Score one answer from collected client-side cheat flags and persist cheat_score/cheat_risk.
    Used by the live flow immediately after /interview/flags updates interview_answers.cheat_flags.
    """
    row = db.execute(text("""
        SELECT ia.id, ia.transcript, ia.code_answer, iq.type AS question_type
        FROM interview_answers ia
        LEFT JOIN interview_questions iq ON iq.id = ia.interview_question_id
        WHERE ia.id = :aid
    """), {"aid": int(answer_id)}).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Answer not found")

    signal_map = {
        "tab-switch": ("TAB_FOCUS_LOST", "C", "high"),
        "window-blur": ("TAB_FOCUS_LOST", "C", "medium"),
        "paste": ("PASTE_EVENT", "C", "high"),
        "copy": ("KEYSTROKE_GAP", "C", "low"),
        "right-click": ("KEYSTROKE_GAP", "C", "medium"),
        "devtools-open": ("SCREEN_SHARE_ACTIVE", "C", "medium"),
        "devtools-shortcut": ("SCREEN_SHARE_ACTIVE", "C", "medium"),
        "fullscreen-exit": ("TAB_FOCUS_LOST", "C", "medium"),
    }

    signals: List[Dict[str, Any]] = []
    for flag in flags or []:
        mapped = signal_map.get(flag)
        if not mapped:
            continue
        signal_type, signal_category, weight = mapped
        signals.append(
            {
                "signal_type": signal_type,
                "signal_category": signal_category,
                "weight": weight,
                "details": {"source_flag": flag},
            }
        )

    cheat_score, risk_key, details = cheat_scorer.score_answer(
        answer_id=int(answer_id),
        signals=signals,
        transcript=row.get("transcript") or "",
        code=row.get("code_answer") or "",
        answer_type=row.get("question_type") or "behavioral",
    )

    db.execute(
        text("""
            UPDATE interview_answers
            SET cheat_score = :score, cheat_risk = :risk
            WHERE id = :aid
        """),
        {"score": float(round(cheat_score, 2)), "risk": risk_key, "aid": int(answer_id)},
    )

    return {
        "answer_id": int(answer_id),
        "cheat_score": float(round(cheat_score, 2)),
        "cheat_risk": risk_key,
        "details": details,
    }


class SignalSubmission(BaseModel):
    """Schema for signal submission"""
    signals: List[Dict[str, Any]]
    metrics: List[Dict[str, Any]]


@router.post("/{session_id}/signals")
async def submit_signals(
    session_id: str,
    submission: SignalSubmission,
    db: Session = Depends(get_db),
):
    """
    Receive cheat signals from frontend during interview.
    Persists signals to database for later analysis.

    Args:
        session_id: Interview session ID
        submission: { signals: [...], metrics: [...] }
    """
    try:
        # Get interview session
        from models.interview import Interview
        interview = db.query(Interview).filter_by(id=session_id).first()
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        # Persist all signals
        for signal in submission.signals:
            cheat_signal = CheatSignal(
                interview_id=interview.id,
                interview_answer_id=signal.get("answer_id"),
                signal_type=signal["signal_type"],
                signal_category=signal["signal_category"],
                weight=signal["weight"],
                details=signal.get("details", {}),
                fired_at=datetime.fromtimestamp(signal["fired_at"] / 1000),
            )
            db.add(cheat_signal)

        db.commit()

        return {
            "status": "ok",
            "signals_persisted": len(submission.signals),
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/score-answer/{answer_id}")
async def score_answer_for_cheating(
    session_id: str,
    answer_id: int,
    db: Session = Depends(get_db),
):
    """
    Score a specific answer for cheat probability.

    Called after answer is submitted (during or after interview).
    Collects all signals for this answer and computes cheat_score + cheat_risk.

    Args:
        session_id: Interview session ID
        answer_id: Specific answer ID to score
    """
    try:
        from models.interview import Interview

        # Get answer and related signals
        answer = db.query(InterviewAnswer).filter_by(id=answer_id).first()
        if not answer:
            raise HTTPException(status_code=404, detail="Answer not found")

        # Fetch all signals for this answer
        signals_db = (
            db.query(CheatSignal)
            .filter_by(interview_answer_id=answer_id)
            .all()
        )

        # Convert to dicts for scorer
        signals = [
            {
                "signal_type": s.signal_type,
                "signal_category": s.signal_category,
                "weight": s.weight,
                "details": s.details,
            }
            for s in signals_db
        ]

        # Score the answer
        cheat_score, risk_key, details = cheat_scorer.score_answer(
            answer_id=answer_id,
            signals=signals,
            transcript=answer.transcript or "",
            code=answer.code_answer or "",
            answer_type=answer.question.question_type if answer.question else "behavioral",
        )

        # Update answer with cheat scores
        answer.cheat_score = cheat_score
        answer.cheat_risk = risk_key
        db.commit()

        return {
            "status": "ok",
            "answer_id": answer_id,
            "cheat_score": round(cheat_score, 2),
            "cheat_risk": risk_key,
            "details": details,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/score-session")
async def score_session_for_cheating(
    session_id: str,
    db: Session = Depends(get_db),
):
    """
    Score entire session (weighted average of answer scores).

    Called at end of interview, after all answers are individually scored.
    """
    try:
        from models.interview import Interview

        interview = db.query(Interview).filter_by(id=session_id).first()
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        # Get all answers for this session
        answers = db.query(InterviewAnswer).filter_by(interview_id=interview.id).all()

        # Prepare for session scoring
        session_answers = [
            {
                "answer_id": a.id,
                "cheat_score": a.cheat_score or 0.0,
                "answer_type": a.question.question_type if a.question else "behavioral",
            }
            for a in answers
        ]

        # Score session
        session_cheat_score, session_risk_key, session_details = cheat_scorer.score_session(
            session_answers
        )

        # Update interview with session-level cheat score
        interview.cheat_score = session_cheat_score
        interview.cheat_risk = session_risk_key
        db.commit()

        return {
            "status": "ok",
            "session_id": session_id,
            "session_cheat_score": round(session_cheat_score, 2),
            "session_cheat_risk": session_risk_key,
            "session_details": session_details,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/cheat-report")
async def get_cheat_report(
    session_id: str,
    db: Session = Depends(get_db),
):
    """
    Get comprehensive cheat report for a session (for company dashboard).

    Shows:
    - Per-answer cheat scores and signals
    - Session-level cheat score
    - Which specific signals triggered
    - Risk assessment summary
    """
    try:
        from models.interview import Interview

        interview = db.query(Interview).filter_by(id=session_id).first()
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        # Collect per-answer data
        answers_report = []
        for answer in interview.answers:
            signals_for_answer = (
                db.query(CheatSignal)
                .filter_by(interview_answer_id=answer.id)
                .all()
            )

            signals_summary = [
                {
                    "signal_type": s.signal_type,
                    "category": s.signal_category,
                    "weight": s.weight,
                    "timestamp": s.fired_at.isoformat(),
                    "details": s.details,
                }
                for s in signals_for_answer
            ]

            answers_report.append({
                "answer_id": answer.id,
                "question_text": answer.question.question_text if answer.question else "",
                "question_type": answer.question.question_type if answer.question else "",
                "cheat_score": answer.cheat_score,
                "cheat_risk": answer.cheat_risk,
                "signals_fired": len(signals_for_answer),
                "signals": signals_summary,
            })

        return {
            "session_id": session_id,
            "session_cheat_score": interview.cheat_score,
            "session_cheat_risk": interview.cheat_risk,
            "total_answers": len(interview.answers),
            "flagged_answers": sum(1 for a in answers_report if a["cheat_score"] > 45),
            "answers": answers_report,
            "recommendation": __get_recommendation(interview.cheat_score),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def __get_recommendation(session_cheat_score: float) -> str:
    """Get hiring recommendation based on cheat score"""
    if session_cheat_score < 20:
        return "No concerns - proceed with interview"
    elif session_cheat_score < 45:
        return "Minor concerns - review manually"
    elif session_cheat_score < 70:
        return "Significant concerns - flagged for review"
    else:
        return "Critical - strong evidence of cheating, consider rejection"
