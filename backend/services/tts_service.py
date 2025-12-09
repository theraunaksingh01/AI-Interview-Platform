import os
from uuid import uuid4

import pyttsx3
from pydub import AudioSegment

# Init engine once (global)
engine = pyttsx3.init()
voices = engine.getProperty("voices")
if voices:
    engine.setProperty("voice", voices[0].id)  # pick first installed voice

engine.setProperty("rate", 150)
engine.setProperty("volume", 1.0)

AUDIO_DIR = os.path.join(os.getcwd(), "agent_audio")
os.makedirs(AUDIO_DIR, exist_ok=True)


def synthesize_speech(text: str) -> bytes:
    """
    Offline TTS using Windows SAPI (pyttsx3).
    Generates a WAV, converts to MP3, returns MP3 bytes.
    """
    if not text or not text.strip():
        return b""

    wav_name = f"{uuid4().hex}.wav"
    mp3_name = f"{uuid4().hex}.mp3"

    wav_path = os.path.join(AUDIO_DIR, wav_name)
    mp3_path = os.path.join(AUDIO_DIR, mp3_name)

    # Generate WAV with pyttsx3
    engine.save_to_file(text, wav_path)
    engine.runAndWait()

    # Convert WAV → MP3
    audio = AudioSegment.from_wav(wav_path)
    audio.export(mp3_path, format="mp3")

    # Clean up wav
    try:
        os.remove(wav_path)
    except OSError:
        pass

    # Return MP3 bytes
    with open(mp3_path, "rb") as f:
        return f.read()
