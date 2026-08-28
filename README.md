# AI Interview Platform
## Name: Cractal

An AI-powered mock interview platform.

## Setup
- Requires Docker Desktop (WSL2 backend)
- Clone this repo
- Run `docker compose up -d` inside `infra/`
- Frontend: Next.js in `/frontend`
- Backend: FastAPI in `/backend`

## Environment
.\.venv311\Scripts\Activate.ps1

## Uvicorn start
uvicorn main:app --reload --port 8000 --host 0.0.0.0

Celery Start
celery -A celery_app.app worker -l info -P solo


