# backend/services/answer_backfill.py
"""
Backfill interview_answers from interview_turns for the live interview flow.

The live interview WebSocket writes candidate transcripts to interview_turns,
but the scoring system reads from interview_answers. This service bridges that gap.
"""
import logging
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import text

log = logging.getLogger(__name__)


def backfill_answers_from_turns(db: Session, interview_id: UUID) -> int:
    """
    For each question in the interview, concatenate all candidate turns'
    transcripts from interview_turns and upsert into interview_answers.
    Returns the number of questions backfilled.
    """
    iid = str(interview_id)

    questions = db.execute(
        text("SELECT id, type FROM interview_questions WHERE interview_id = :iid ORDER BY id"),
        {"iid": iid},
    ).fetchall()

    if not questions:
        return 0

    count = 0
    for q in questions:
        qid = q[0]
        qtype = q[1] if len(q) > 1 else "voice"

        turns = db.execute(
            text("""
                SELECT transcript FROM interview_turns
                WHERE interview_id = :iid
                  AND question_id = :qid
                  AND speaker = 'candidate'
                ORDER BY started_at ASC
            """),
            {"iid": iid, "qid": qid},
        ).fetchall()

        full_transcript = " ".join(
            t[0] for t in turns if t[0]
        ).strip()

        if not full_transcript:
            continue

        word_count = len(full_transcript.split())

        existing = db.execute(
            text("""
                SELECT id FROM interview_answers
                WHERE interview_question_id = :qid
                LIMIT 1
            """),
            {"qid": qid},
        ).scalar()

        if existing:
            if qtype == "code":
                db.execute(
                    text("UPDATE interview_answers SET transcript = :t, code_answer = :c, answer_word_count = :wc WHERE id = :aid"),
                    {"t": full_transcript, "c": full_transcript, "wc": word_count, "aid": existing},
                )
            else:
                db.execute(
                    text("UPDATE interview_answers SET transcript = :t, answer_word_count = :wc WHERE id = :aid"),
                    {"t": full_transcript, "wc": word_count, "aid": existing},
                )
        else:
            if qtype == "code":
                db.execute(
                    text("""
                        INSERT INTO interview_answers (interview_question_id, transcript, code_answer, answer_word_count)
                        VALUES (:qid, :t, :c, :wc)
                    """),
                    {"qid": qid, "t": full_transcript, "c": full_transcript, "wc": word_count},
                )
            else:
                db.execute(
                    text("""
                        INSERT INTO interview_answers (interview_question_id, transcript, answer_word_count)
                        VALUES (:qid, :t, :wc)
                    """),
                    {"qid": qid, "t": full_transcript, "wc": word_count},
                )
        count += 1

    db.commit()
    log.info("[BACKFILL] interview=%s backfilled %d questions", iid, count)
    return count
