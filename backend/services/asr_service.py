import os
import tempfile
import logging
import numpy as np

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

model = WhisperModel(
    "small",
    device="cpu",
    compute_type="float32",
)


def transcribe_audio_bytes(audio_bytes: bytes) -> str:
    """
    Final ASR transcription.
    Uses backend-buffered audio.
    Fails safely if container is invalid.
    """

    # 🛑 Guard: empty or too small
    if not audio_bytes or len(audio_bytes) < 4000:
        logger.warning("Final ASR skipped: empty / insufficient audio")
        return ""

    fd, path = tempfile.mkstemp(suffix=".webm")

    try:
        with os.fdopen(fd, "wb") as f:
            f.write(audio_bytes)

        try:
            segments, _ = model.transcribe(
                path,
                language="en",
                beam_size=5,
                vad_filter=False,
                condition_on_previous_text=False,
                temperature=0.0,
            )
        except Exception:
            # 🚨 INVALID WEBM (fragmented MediaRecorder output)
            logger.error(
                "Final ASR failed: invalid WebM container (expected for fragmented chunks)",
                exc_info=True,
            )
            return ""

        text = " ".join(seg.text.strip() for seg in segments).strip()
        return text

    finally:
        try:
            os.remove(path)
        except OSError:
            pass

def transcribe_pcm_bytes(pcm_bytes: bytes) -> str:
    """
    Transcribe raw PCM Int16 LE audio (16kHz, mono).
    """
    if not pcm_bytes:
        return ""

    audio = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0

    segments, _ = model.transcribe(
        audio,
        language="en",
        beam_size=5,
        vad_filter=True,           # skip silent segments — main source of hallucinations
        condition_on_previous_text=False,
        temperature=0.0,
    )

    return " ".join(seg.text.strip() for seg in segments).strip()


def transcribe_pcm_with_vad_result(pcm_bytes: bytes) -> dict:
    """
    Transcribe raw PCM Int16 LE audio (16kHz, mono) and expose VAD metadata.
    Returns: {"transcript": str, "is_silence": bool, "duration_after_vad": float}
    """
    if not pcm_bytes:
        return {
            "transcript": "",
            "is_silence": True,
            "duration_after_vad": 0.0,
        }

    audio = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0

    segments, info = model.transcribe(
        audio,
        language="en",
        beam_size=5,
        vad_filter=True,
        condition_on_previous_text=False,
        temperature=0.0,
    )

    segments_list = list(segments)
    transcript = " ".join(seg.text.strip() for seg in segments_list).strip()
    duration_after_vad = float(getattr(info, "duration_after_vad", 0.0) or 0.0)
    is_silence = len(transcript) == 0 and duration_after_vad < 0.1

    return {
        "transcript": transcript,
        "is_silence": is_silence,
        "duration_after_vad": duration_after_vad,
    }