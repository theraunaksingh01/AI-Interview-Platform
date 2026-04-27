import os
import tempfile
import logging
import numpy as np
from typing import Any, Dict, List

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

    result = transcribe_audio_bytes_with_segments(audio_bytes)
    return result.get("transcript", "")


def transcribe_audio_bytes_with_segments(audio_bytes: bytes) -> Dict[str, Any]:
    """
    Final ASR transcription with segment timestamps.
    Returns: {"transcript": str, "segments": [{"start": float, "end": float, "text": str}, ...]}
    """
    logger.info("transcribe_audio_bytes_with_segments called")
    if not audio_bytes or len(audio_bytes) < 4000:
        logger.warning("Final ASR skipped: empty / insufficient audio")
        return {"transcript": "", "segments": []}

    fd, path = tempfile.mkstemp(suffix=".webm")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(audio_bytes)

        try:
            segments_iter, _ = model.transcribe(
                path,
                language="en",
                beam_size=5,
                vad_filter=False,
                condition_on_previous_text=False,
                temperature=0.0,
            )
        except Exception:
            logger.error(
                "Final ASR failed: invalid WebM container (expected for fragmented chunks)",
                exc_info=True,
            )
            return {"transcript": "", "segments": []}

        segments_list: List[Dict[str, Any]] = []
        transcript_parts: List[str] = []
        for seg in list(segments_iter):
            seg_text = str(getattr(seg, "text", "") or "").strip()
            if seg_text:
                transcript_parts.append(seg_text)
            segments_list.append(
                {
                    "start": float(getattr(seg, "start", 0.0) or 0.0),
                    "end": float(getattr(seg, "end", 0.0) or 0.0),
                    "text": seg_text,
                }
            )

        logger.info(
            "ASR segments: %s segs, first_start=%s",
            len(segments_list),
            (segments_list[0].get("start") if segments_list else None),
        )

        return {
            "transcript": " ".join(transcript_parts).strip(),
            "segments": segments_list,
        }
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