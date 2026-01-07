# backend/services/asr_service.py

from faster_whisper import WhisperModel
import tempfile
import os

model = WhisperModel("base", device="cpu", compute_type="int16")


def transcribe_audio_bytes(audio_bytes: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    segments, _ = model.transcribe(tmp_path)
    text = " ".join(seg.text for seg in segments)

    os.remove(tmp_path)
    return text.strip()
