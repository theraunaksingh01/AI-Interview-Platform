# Cractal code runner: holds no secrets, no DB access.
FROM python:3.11-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends g++ default-jdk-headless util-linux \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir fastapi "uvicorn[standard]" pydantic

# Unprivileged user: student code never runs as root.
RUN useradd --create-home --shell /usr/sbin/nologin runner
WORKDIR /srv
COPY app.py /srv/app.py
USER runner

ENV PYTHONUNBUFFERED=1
EXPOSE 8080
# Railway sets $PORT; fall back to 8080 locally.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]
