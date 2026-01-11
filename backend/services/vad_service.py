# backend/services/vad_service.py
import numpy as np
import time
from typing import Dict

# interview_id:question_id → vad state
VAD_STATE: Dict[str, dict] = {}

# ---- Tunables (safe defaults) ----
SILENCE_THRESHOLD_RMS = 0.01   # Energy threshold
SILENCE_DURATION_SEC = 1.2     # Stop after 1.2s silence


def _key(interview_id: str, question_id: int) -> str:
    return f"{interview_id}:{question_id}"


def _rms_energy(audio_pcm: bytes) -> float:
    """
    Compute RMS energy from 16-bit PCM audio.
    """
    if not audio_pcm:
        return 0.0

    pcm = np.frombuffer(audio_pcm, dtype=np.int16).astype(np.float32)
    if pcm.size == 0:
        return 0.0

    return np.sqrt(np.mean(pcm ** 2)) / 32768.0


def update_vad(
    interview_id: str,
    question_id: int,
    audio_pcm: bytes,
) -> bool:
    """
    Returns True if speech has ENDED.
    """
    key = _key(interview_id, question_id)
    now = time.time()

    energy = _rms_energy(audio_pcm)

    state = VAD_STATE.setdefault(
        key,
        {
            "last_speech_ts": now,
            "speech_detected": False,
        },
    )

    if energy > SILENCE_THRESHOLD_RMS:
        # Speech detected
        state["last_speech_ts"] = now
        state["speech_detected"] = True
        return False

    # Silence
    if not state["speech_detected"]:
        # Haven't spoken yet → ignore
        return False

    silence_time = now - state["last_speech_ts"]

    return silence_time >= SILENCE_DURATION_SEC


def clear_vad(interview_id: str, question_id: int):
    VAD_STATE.pop(_key(interview_id, question_id), None)
