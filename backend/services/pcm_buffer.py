# backend/services/pcm_buffer.py

from collections import defaultdict
from threading import Lock

# interview_id -> question_id -> list[bytes]
_PCM_BUFFERS = defaultdict(lambda: defaultdict(list))
_LOCK = Lock()


def append_pcm(interview_id: str, question_id: int, pcm_bytes: bytes) -> None:
    """
    Append raw PCM bytes (Int16 LE) for a given interview + question.
    """
    if not pcm_bytes:
        return

    with _LOCK:
        _PCM_BUFFERS[interview_id][question_id].append(pcm_bytes)


def pop_full_pcm(interview_id: str, question_id: int) -> bytes:
    """
    Pop and clear all buffered PCM bytes for a question.
    Returns concatenated PCM bytes.
    """
    with _LOCK:
        chunks = _PCM_BUFFERS.get(interview_id, {}).pop(question_id, [])

        # cleanup interview bucket if empty
        if interview_id in _PCM_BUFFERS and not _PCM_BUFFERS[interview_id]:
            _PCM_BUFFERS.pop(interview_id, None)

    return b"".join(chunks)
