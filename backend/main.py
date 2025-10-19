from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.roles import router as roles_router

app = FastAPI(title="AI Interview Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend dev origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health(): return {"ok": True}

app.include_router(roles_router)
