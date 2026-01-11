# backend/services/streaming_asr.py

from collections import defaultdict
from typing import Dict, Tuple
from services.asr_service import transcribe_audio_bytes

# interview_id:question_id → rolling WEBM buffer
STREAM_BUFFERS: Dict[str, bytearray] = defaultdict(bytearray)

# Keep ~20 seconds of audio (safe window)
MAX_BUFFER_BYTES = 20 * 16000 * 2


def _key(interview_id: str, question_id: int) -> str:
    return f"{interview_id}:{question_id}"


def append_audio(
    interview_id: str,
    question_id: int,
    chunk: bytes,
) -> Tuple[str, bool]:
    """
    Append WEBM/OPUS audio chunk and return:
    (partial_text, speech_ended)

    NOTE:
    - MediaRecorder sends COMPRESSED audio
    - DO NOT attempt RMS / numpy / PCM math
    """

    if not chunk:
        return "", False

    key = _key(interview_id, question_id)
    buf = STREAM_BUFFERS[key]

    # Append chunk
    buf.extend(chunk)

    # Rolling buffer
    if len(buf) > MAX_BUFFER_BYTES:
        STREAM_BUFFERS[key] = buf[-MAX_BUFFER_BYTES:]

    # Transcribe rolling window
    text = transcribe_audio_bytes(bytes(STREAM_BUFFERS[key]))

    # We do NOT detect silence here
    # Speech end is controlled by frontend stop
    speech_ended = False

    return text, speech_ended


def clear_stream(interview_id: str, question_id: int):
    """
    Clear buffer after final submit
    """
    STREAM_BUFFERS.pop(_key(interview_id, question_id), None)
