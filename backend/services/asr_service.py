import os
import tempfile
import logging
import numpy as np
from typing import Any, Dict, List
from services.whisper_loader import transcribe_audio

logger = logging.getLogger(__name__)




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
            segments_iter, _ = transcribe_audio(path, vad_filter=False)
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

    segments, _ = transcribe_audio(audio)

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

    segments, info = transcribe_audio(audio)

    segments_list = list(segments)
    transcript = " ".join(seg.text.strip() for seg in segments_list).strip()
    duration_after_vad = float(getattr(info, "duration_after_vad", 0.0) or 0.0)
    is_silence = len(transcript) == 0 and duration_after_vad < 0.1

    return {
        "transcript": transcript,
        "is_silence": is_silence,
        "duration_after_vad": duration_after_vad,
    }