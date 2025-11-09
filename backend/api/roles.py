# backend/api/roles.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.session import SessionLocal
from db.models import Role
from models.role import RoleCreate, RoleOut

router = APIRouter(prefix="/roles", tags=["roles"])

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

@router.post("", response_model=RoleOut)
def create_role(payload: RoleCreate, db: Session = Depends(get_db)):
    role = Role(title=payload.title, level=payload.level, jd_text=payload.jd_text)
    db.add(role); db.commit(); db.refresh(role)
    return role

@router.get("", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db)):
    return db.query(Role).order_by(Role.id.desc()).all()
