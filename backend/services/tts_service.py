# backend/services/tts_service.py
import os
import logging
import tempfile
from uuid import uuid4
from typing import Optional

import pyttsx3
from pydub import AudioSegment

logger = logging.getLogger(__name__)

# Directory where permanent agent audio files are stored (your existing folder)
AUDIO_DIR = os.path.join(os.getcwd(), "agent_audio")
os.makedirs(AUDIO_DIR, exist_ok=True)


def _init_engine() -> pyttsx3.Engine:
    """
    Create and return a new pyttsx3 engine instance.
    Creating engine per-call avoids sharing one global engine across threads/tasks.
    """
    engine = pyttsx3.init()
    try:
        voices = engine.getProperty("voices")
        if voices:
            engine.setProperty("voice", voices[0].id)
        engine.setProperty("rate", 150)
        engine.setProperty("volume", 1.0)
    except Exception:
        # On some platforms voices/properties may behave differently; ignore non-fatal errors
        logger.exception("Warning: unable to configure pyttsx3 properties")
    return engine


def synthesize_speech(text: str) -> Optional[bytes]:
    """
    Synthesize `text` to MP3 bytes using pyttsx3 -> WAV -> MP3 (pydub).
    Returns MP3 bytes on success, or None on failure.

    IMPORTANT:
      - This is blocking (pyttsx3.runAndWait). Call from an async environment using:
          await asyncio.to_thread(synthesize_speech, text)
      - Requires `ffmpeg` installed for pydub to export MP3.
    """
    if not text or not text.strip():
        return None

    # use mkstemp to avoid permission issues on Windows
    wav_fd, wav_path = tempfile.mkstemp(prefix="tts_", suffix=".wav", dir=AUDIO_DIR)
    os.close(wav_fd)  # close the low level fd, pyttsx3 will write to path

    mp3_fd, mp3_path = tempfile.mkstemp(prefix="tts_", suffix=".mp3", dir=AUDIO_DIR)
    os.close(mp3_fd)

    try:
        # create a fresh engine per call (safer for concurrency)
        engine = _init_engine()

        # pyttsx3 writes WAV to wav_path
        try:
            engine.save_to_file(text, wav_path)
            engine.runAndWait()
        except Exception as e:
            logger.exception("pyttsx3 TTS generation failed: %s", e)
            # cleanup wav if exists
            try:
                if os.path.exists(wav_path):
                    os.remove(wav_path)
            except Exception:
                pass
            return None

        # Convert WAV -> MP3 with pydub (requires ffmpeg)
        try:
            audio = AudioSegment.from_wav(wav_path)
            audio.export(mp3_path, format="mp3")
        except Exception as e:
            logger.exception("WAV->MP3 conversion failed: %s", e)
            # cleanup
            try:
                if os.path.exists(wav_path):
                    os.remove(wav_path)
            except Exception:
                pass
            return None

        # read MP3 bytes
        with open(mp3_path, "rb") as f:
            mp3_bytes = f.read()

        return mp3_bytes

    finally:
        # cleanup temp files (we keep permanent saved copies to save_agent_audio_file)
        try:
            if os.path.exists(wav_path):
                os.remove(wav_path)
        except Exception:
            logger.exception("Failed to remove wav temp file: %s", wav_path)
        try:
            if os.path.exists(mp3_path):
                os.remove(mp3_path)
        except Exception:
            # if you want to keep mp3 files permanently, remove this cleanup or move files elsewhere
            logger.exception("Failed to remove mp3 temp file: %s", mp3_path)
