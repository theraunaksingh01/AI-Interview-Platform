# backend/api/rubric.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, Optional
from db.session import SessionLocal
from db.models import Role
from pydantic import BaseModel

router = APIRouter(prefix="/api/company", tags=["rubric"])

# Pydantic models
class RubricDimension(BaseModel):
    label: str
    weight: int
    description: Optional[str] = None

class RubricResponse(BaseModel):
    rubric: Optional[Dict[str, RubricDimension]]
    locked: bool = False
    reason: Optional[str] = None

# Default templates
RUBRIC_TEMPLATES = {
    "software_engineer": {
        "dsa": {
            "label": "DSA & Problem Solving",
            "weight": 30,
            "description": "Data structures, algorithms, time/space complexity"
        },
        "system_design": {
            "label": "System Design",
            "weight": 25,
            "description": "Scalability, architecture, trade-offs"
        },
        "communication": {
            "label": "Communication",
            "weight": 20,
            "description": "Clarity, structure, ability to explain"
        },
        "problem_solving": {
            "label": "Problem Solving Approach",
            "weight": 15,
            "description": "How they break down and tackle problems"
        },
        "culture_fit": {
            "label": "Culture Fit",
            "weight": 10,
            "description": "Values alignment, collaboration signals"
        }
    },
    "product_manager": {
        "product_thinking": {
            "label": "Product Thinking",
            "weight": 35,
            "description": "Product vision, user empathy, prioritization"
        },
        "analytical": {
            "label": "Analytical Reasoning",
            "weight": 25,
            "description": "Data-driven decision making, metrics understanding"
        },
        "communication": {
            "label": "Communication",
            "weight": 20,
            "description": "Storytelling, stakeholder management"
        },
        "execution": {
            "label": "Execution & Prioritization",
            "weight": 20,
            "description": "Roadmap planning, shipping speed"
        }
    },
    "sales_non_tech": {
        "communication": {
            "label": "Communication",
            "weight": 40,
            "description": "Listening, persuasion, presentation"
        },
        "domain_knowledge": {
            "label": "Domain Knowledge",
            "weight": 25,
            "description": "Industry expertise, product understanding"
        },
        "problem_solving": {
            "label": "Problem Solving",
            "weight": 20,
            "description": "Handling objections, creative solutions"
        },
        "culture_fit": {
            "label": "Culture Fit",
            "weight": 15,
            "description": "Team fit, collaboration, adaptability"
        }
    }
}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def is_rubric_locked(role_id: int, db: Session) -> tuple[bool, Optional[str]]:
    """Check if rubric is locked when completed interviews exist for this specific role."""
    count = db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM interviews i
            JOIN job_applications ja ON ja.id = i.application_id
            WHERE ja.job_id = :role_id
              AND i.status = 'completed'
            """
        ),
        {"role_id": role_id},
    ).scalar() or 0

    if count > 0:
        return True, "Rubric is locked because interviews have been conducted. Duplicate this role to use a different rubric."
    return False, None

# Endpoints
@router.get("/rubric-templates")
def get_templates():
    """Get default rubric templates"""
    return RUBRIC_TEMPLATES

@router.post("/roles/{role_id}/rubric")
def save_rubric(role_id: int, rubric: Dict[str, Any], db: Session = Depends(get_db)):
    """Save/update rubric for a role"""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Validate rubric
    error = validate_rubric(rubric)
    if error:
        raise HTTPException(status_code=400, detail=error)

    role.rubric_weights = rubric
    db.commit()
    db.refresh(role)
    return {"id": role.id, "rubric": role.rubric_weights}

@router.get("/roles/{role_id}/rubric")
def get_rubric(role_id: int, db: Session = Depends(get_db)):
    """Get current rubric for a role"""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    locked, reason = is_rubric_locked(role_id, db)
    return RubricResponse(
        rubric=role.rubric_weights,
        locked=locked,
        reason=reason
    )

@router.get("/roles/{role_id}/rubric/locked")
def get_rubric_locked_status(role_id: int, db: Session = Depends(get_db)):
    """Check if rubric is locked"""
    locked, reason = is_rubric_locked(role_id, db)
    return {"locked": locked, "reason": reason}

def validate_rubric(rubric: Dict[str, Any]) -> Optional[str]:
    """Validate rubric structure and weights"""
    if not rubric:
        return "Rubric cannot be empty"

    keys = list(rubric.keys())

    if len(keys) < 2:
        return "Add at least 2 dimensions"
    if len(keys) > 8:
        return "Maximum 8 dimensions allowed"

    total_weight = 0
    for key, dimension in rubric.items():
        if not isinstance(dimension, dict):
            return f"Dimension '{key}' must be an object"

        if "label" not in dimension or not dimension["label"].strip():
            return "All dimensions need a label"

        if "weight" not in dimension:
            return f"Dimension '{key}' missing weight"

        weight = dimension["weight"]
        if not isinstance(weight, (int, float)) or weight < 1:
            return f"Dimension '{key}' weight must be at least 1"

        total_weight += weight

    if total_weight != 100:
        return f"Weights total {total_weight}% — must be exactly 100%"

    return None
