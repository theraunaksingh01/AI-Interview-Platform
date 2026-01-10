import os
from uuid import uuid4
import pythoncom
import pyttsx3

AUDIO_DIR = os.path.join(os.getcwd(), "agent_audio")
os.makedirs(AUDIO_DIR, exist_ok=True)


def synthesize_speech(text: str) -> bytes:
    if not text.strip():
        return b""

    # REQUIRED for Windows threads
    pythoncom.CoInitialize()

    engine = pyttsx3.init()
    engine.setProperty("rate", 150)
    engine.setProperty("volume", 1.0)

    filename = f"{uuid4().hex}.wav"
    path = os.path.join(AUDIO_DIR, filename)

    engine.save_to_file(text, path)
    engine.runAndWait()

    with open(path, "rb") as f:
        data = f.read()

    return data
