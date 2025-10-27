# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.roles import router as roles_router
from api import auth as auth_router   # new

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

# existing roles router
app.include_router(roles_router)

# new auth router
app.include_router(auth_router.router)
