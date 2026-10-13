# backend/Dockerfile -- used for BOTH the API service and the Celery worker.
# Railway: set Root Directory = backend. The worker service overrides the Start Command.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/opt/hf

# ffmpeg: audio decoding for Whisper. espeak-ng/libespeak1: Linux voice for pyttsx3.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg espeak-ng libespeak1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.prod.txt .
RUN pip install -r requirements.prod.txt

# Bake the Whisper model into the image so the first request isn't a 500 MB download.
# Must match the WHISPER_MODEL env var you set on Railway (default: small).
ARG WHISPER_MODEL=small
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('${WHISPER_MODEL}', device='cpu', compute_type='int8')"

COPY . .

RUN useradd -m app && chown -R app:app /app /opt/hf
USER app

EXPOSE 8000
# API start command. The worker service overrides this in Railway with:
#   celery -A celery_app worker --loglevel=info --concurrency=2
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]