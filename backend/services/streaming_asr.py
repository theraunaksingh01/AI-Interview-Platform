# backend/services/streaming_asr.py
from collections import defaultdict
from typing import Dict, Tuple

from services.asr_service import transcribe_audio_bytes
from services.vad_service import update_vad, clear_vad

# interview_id:question_id → rolling audio buffer
STREAM_BUFFERS: Dict[str, bytearray] = defaultdict(bytearray)

# ~10 seconds @ 16kHz mono 16-bit PCM
MAX_BUFFER_BYTES = 10 * 16000 * 2


def _key(interview_id: str, question_id: int) -> str:
    return f"{interview_id}:{question_id}"


def append_audio(
    interview_id: str,
    question_id: int,
    chunk: bytes,
) -> Tuple[str, bool]:
    """
    Returns (partial_text, speech_ended)
    """
    key = _key(interview_id, question_id)
    buf = STREAM_BUFFERS[key]

    buf.extend(chunk)

    # Trim rolling buffer
    if len(buf) > MAX_BUFFER_BYTES:
        STREAM_BUFFERS[key] = buf[-MAX_BUFFER_BYTES:]

    # ---- VAD check ----
    speech_ended = update_vad(interview_id, question_id, chunk)

    # ---- Partial transcription ----
    text = transcribe_audio_bytes(bytes(STREAM_BUFFERS[key]))

    return text, speech_ended


def clear_stream(interview_id: str, question_id: int):
    STREAM_BUFFERS.pop(_key(interview_id, question_id), None)
    clear_vad(interview_id, question_id)
