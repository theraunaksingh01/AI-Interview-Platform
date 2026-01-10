from collections import defaultdict
from typing import Dict
import tempfile
import os

from services.asr_service import transcribe_audio_bytes

# =========================================================
# interview_id:question_id → rolling WebM buffer
# =========================================================
STREAM_BUFFERS: Dict[str, bytearray] = defaultdict(bytearray)

# ~8 seconds buffer (safe for Whisper)
MAX_BUFFER_BYTES = 8 * 1024 * 1024  # 8MB


def _key(interview_id: str, question_id: int) -> str:
    return f"{interview_id}:{question_id}"


def append_audio(interview_id: str, question_id: int, chunk: bytes) -> str:
    """
    Append MediaRecorder WebM chunks into a rolling buffer,
    decode ONLY the combined buffer.
    """
    key = _key(interview_id, question_id)
    buf = STREAM_BUFFERS[key]

    # Append raw WebM bytes
    buf.extend(chunk)

    # Trim old data (keep tail)
    if len(buf) > MAX_BUFFER_BYTES:
        STREAM_BUFFERS[key] = buf[-MAX_BUFFER_BYTES:]

    # Decode ONLY combined buffer
    return transcribe_audio_bytes(bytes(STREAM_BUFFERS[key]))


def clear_stream(interview_id: str, question_id: int):
    STREAM_BUFFERS.pop(_key(interview_id, question_id), None)
