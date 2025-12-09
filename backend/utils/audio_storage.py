import os
from uuid import uuid4

AUDIO_DIR = os.path.join(os.getcwd(), "agent_audio")
os.makedirs(AUDIO_DIR, exist_ok=True)


def save_agent_audio_file(data: bytes) -> str:
    """
    Save MP3 bytes to agent_audio directory.
    Returns public URL path like /media/agent_audio/<file>.mp3
    """
    filename = f"{uuid4().hex}.mp3"
    filepath = os.path.join(AUDIO_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(data)

    # Must match StaticFiles mount in main.py
    return f"/media/agent_audio/{filename}"
