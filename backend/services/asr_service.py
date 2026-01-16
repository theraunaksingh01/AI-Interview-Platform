import os
import tempfile
import logging

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

model = WhisperModel(
    "base",
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
                vad_filter=True,
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
