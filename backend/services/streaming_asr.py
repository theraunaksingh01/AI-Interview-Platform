# backend/services/streaming_asr.py

from collections import defaultdict
from typing import Dict
import io
from services.asr_service import transcribe_audio_bytes


# interview_id:question_id → audio bytes
STREAM_BUFFERS: Dict[str, bytearray] = defaultdict(bytearray)

def get_stream_key(interview_id: str, question_id: int) -> str:
    return f"{interview_id}:{question_id}"

def append_audio(interview_id: str, question_id: int, chunk: bytes) -> bytes:
    key = get_stream_key(interview_id, question_id)
    STREAM_BUFFERS[key] += chunk

    # Limit buffer to last ~12 seconds (prevent memory bloat)
    max_bytes = 12 * 16000 * 2  # rough PCM estimate
    if len(STREAM_BUFFERS[key]) > max_bytes:
        STREAM_BUFFERS[key] = STREAM_BUFFERS[key][-max_bytes:]

    return bytes(STREAM_BUFFERS[key])

def clear_stream(interview_id: str, question_id: int):
    STREAM_BUFFERS.pop(get_stream_key(interview_id, question_id), None)
