from __future__ import annotations

from threading import Lock
from typing import Any, Dict
from uuid import UUID


_STATE_LOCK = Lock()
_INTERVIEW_STATE: Dict[str, Dict[str, Any]] = {}


def _key(interview_id: UUID | str) -> str:
    return str(interview_id)


def get_interview_state(interview_id: UUID | str) -> Dict[str, Any]:
    key = _key(interview_id)
    with _STATE_LOCK:
        return _INTERVIEW_STATE.setdefault(
            key,
            {
                "answer_submitted": False,
                "active_question_id": None,
            },
        )


def set_answer_submitted(interview_id: UUID | str, submitted: bool) -> None:
    state = get_interview_state(interview_id)
    state["answer_submitted"] = bool(submitted)


def set_active_question(interview_id: UUID | str, question_id: int | None) -> None:
    state = get_interview_state(interview_id)
    state["active_question_id"] = question_id
    state["answer_submitted"] = False


def clear_interview_state(interview_id: UUID | str) -> None:
    key = _key(interview_id)
    with _STATE_LOCK:
        _INTERVIEW_STATE.pop(key, None)
