import os
import sys
import logging
import tempfile

log = logging.getLogger(__name__)


def synthesize_speech(text: str) -> bytes:
    """Return WAV bytes for `text`, or b"" if TTS is unavailable.

    Windows (dev): SAPI voices via pyttsx3 + pythoncom.
    Linux (prod):  espeak-ng via pyttsx3 (must be installed in the image).
    Never raises: the interview must continue even if audio fails.
    """
    if not text or not text.strip():
        return b""

    path = None
    try:
        if sys.platform == "win32":
            import pythoncom  # only exists on Windows
            pythoncom.CoInitialize()

        import pyttsx3

        engine = pyttsx3.init()
        engine.setProperty("rate", 150)
        engine.setProperty("volume", 1.0)

        fd, path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)

        engine.save_to_file(text, path)
        engine.runAndWait()

        with open(path, "rb") as f:
            return f.read()
    except Exception:
        log.exception("TTS failed; continuing without audio")
        return b""
    finally:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass