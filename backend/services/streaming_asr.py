# backend/services/streaming_asr.py

from collections import defaultdict
from typing import Dict

# interview_id:question_id → audio buffer
STREAM_BUFFERS: Dict[str, bytearray] = defaultdict(bytearray)

# Max ~2 minutes @ 16kHz mono (safe cap)
MAX_BUFFER_BYTES = 2 * 60 * 16000 * 2


def _key(interview_id: str, question_id: int) -> str:
    return f"{interview_id}:{question_id}"


def append_audio(interview_id: str, question_id: int, chunk: bytes) -> None:
    """
    Only buffer audio.
    NO transcription here.
    """
    key = _key(interview_id, question_id)
    buf = STREAM_BUFFERS[key]
    buf.extend(chunk)

    if len(buf) > MAX_BUFFER_BYTES:
        STREAM_BUFFERS[key] = buf[-MAX_BUFFER_BYTES:]


def pop_full_audio(interview_id: str, question_id: int) -> bytes:
    """
    Return full audio for a question and clear buffer.
    """
    key = _key(interview_id, question_id)
    return STREAM_BUFFERS.pop(key, bytearray())
