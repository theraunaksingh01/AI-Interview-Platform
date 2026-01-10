from faster_whisper import WhisperModel
import tempfile
import os
from pydub import AudioSegment

model = WhisperModel(
    "base",
    device="cpu",
    compute_type="float32",
)

def transcribe_audio_bytes(audio_bytes: bytes) -> str:
    if not audio_bytes:
        return ""

    raw_path = None
    wav_path = None

    try:
        # Write combined WebM buffer
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            raw_path = f.name

        wav_path = raw_path.replace(".webm", ".wav")

        audio = AudioSegment.from_file(raw_path)
        audio = audio.set_channels(1).set_frame_rate(16000)
        audio.export(wav_path, format="wav")

        segments, _ = model.transcribe(wav_path)
        return " ".join(seg.text.strip() for seg in segments).strip()

    except Exception as e:
        # Fail silently for partial buffers
        return ""

    finally:
        for p in (raw_path, wav_path):
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass
