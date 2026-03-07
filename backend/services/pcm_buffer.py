# backend/services/pcm_buffer.py

from collections import defaultdict
from threading import Lock
from time import time

_PARTIAL_TRACKER = defaultdict(lambda: defaultdict(lambda: {
    "bytes_since_eval": 0,
    "last_eval_at": 0
}))


# interview_id -> question_id -> list[bytes]
_PCM_BUFFERS = defaultdict(lambda: defaultdict(list))
_LOCK = Lock()


def append_pcm(interview_id: str, question_id: int, pcm_bytes: bytes) -> None:
    if not pcm_bytes:
        return

    with _LOCK:
        buffer = _PCM_BUFFERS[interview_id][question_id]
        buffer.append(pcm_bytes)
        
        # keep only last ~4 seconds
        max_bytes = 16000 * 2 * 4
        joined = b"".join(buffer)
        
        if len(joined) > max_bytes:
            joined = joined[-max_bytes:]
            _PCM_BUFFERS[interview_id][question_id] = [joined]

        tracker = _PARTIAL_TRACKER[interview_id][question_id]
        tracker["bytes_since_eval"] += len(pcm_bytes)


def should_trigger_partial_eval(interview_id: str, question_id: int) -> bool:
    with _LOCK:
        tracker = _PARTIAL_TRACKER.get(interview_id, {}).get(question_id)
        if not tracker:
            return False

        now = time()

        # ~10 seconds of 16kHz mono PCM ≈ 320k bytes
        if tracker["bytes_since_eval"] > 60_000 and (now - tracker["last_eval_at"]) > 2:
            tracker["bytes_since_eval"] = 0
            tracker["last_eval_at"] = now
            return True

    return False

def get_pcm_buffer(interview_id: str, question_id: int) -> bytes:
    with _LOCK:
        chunks = _PCM_BUFFERS.get(interview_id, {}).get(question_id, [])

    audio = b"".join(chunks)

    # keep only last ~4 seconds
    max_bytes = 16000 * 2 * 4
    
    if len(audio) > max_bytes:
        audio = audio[-max_bytes:]

    return audio


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
