# AI Interview Platform
## Name: Qurio – from “curious” + “query”

A prototype AI-powered interview platform built with FastAPI + Next.js + Docker.

## Setup
- Requires Docker Desktop (WSL2 backend)
- Clone this repo
- Run `docker compose up -d` inside `infra/`
- Frontend: Next.js in `/frontend`
- Backend: FastAPI in `/backend`

## Environment
.\.venv311\Scripts\Activate.ps1

## Uvicorn start
uvicorn main:app --reload --port 8000

Celery Start
celery -A celery_app.app worker -l info -P solo

Store the token in the browser for the frontend to use
localStorage.setItem('access_token', '<PASTE_ACCESS_TOKEN_HERE>');
