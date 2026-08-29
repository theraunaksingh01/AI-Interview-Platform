# backend/api/companies.py
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.session import get_db

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("")
def list_companies(db: Session = Depends(get_db)):
    """List all published companies for the /companies listing page."""
    rows = db.execute(
        text("""
            SELECT
                id, company, slug, logo_emoji, description,
                hires_annually, salary_range, tier,
                most_asked_topics, difficulty_range
            FROM company_profiles
            WHERE is_published = TRUE
            ORDER BY tier ASC, company ASC
        """)
    ).mappings().all()

    return {"companies": [dict(r) for r in rows]}


@router.get("/{slug}")
def get_company(slug: str, db: Session = Depends(get_db)):
    """Full company page data by slug."""
    row = db.execute(
        text("""
            SELECT *
            FROM company_profiles
            WHERE slug = :slug AND is_published = TRUE
            LIMIT 1
        """),
        {"slug": slug},
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Company not found")

    return dict(row)


@router.get("/{slug}/question-count")
def get_company_question_count(slug: str, db: Session = Depends(get_db)):
    """Return question bank stats for a company — used in the prep section."""
    slug_to_tag = {
        "tcs": "TCS", "infosys": "Infosys", "wipro": "Wipro",
        "cognizant": "Cognizant GenC", "accenture": "Accenture",
        "capgemini": "Capgemini", "amazon": "Amazon",
        "microsoft": "Microsoft", "hcl": "HCLTech",
        "tech-mahindra": "Tech Mahindra",
        "deloitte": "Deloitte", "ibm": "IBM",
        "mindtree": "LTIMindtree",
        "mphasis": "Mphasis",
        "google": "Google", "meta": "Meta", "apple": "Apple",
        "flipkart": "Flipkart", "adobe": "Adobe",
        "goldman-sachs": "Goldman Sachs",
        "jp-morgan": "JP Morgan", "oracle": "Oracle",
        "qualcomm": "Qualcomm", "salesforce": "Salesforce",
        "atlassian": "Atlassian", "uber": "Uber",
        "phonepe": "PhonePe", "zomato": "Zomato",
        "walmart": "Walmart",
    }
    company_tag = slug_to_tag.get(slug)
    if not company_tag:
        return {"voice_count": 0, "dsa_count": 0, "total": 0}

    try:
        # Try company_tags array column first (most likely schema)
        counts = db.execute(
            text("""
                SELECT
                    COUNT(*) FILTER (WHERE type = 'voice') AS voice_count,
                    COUNT(*) FILTER (WHERE type = 'code')  AS dsa_count,
                    COUNT(*)                                  AS total
                FROM questions
                WHERE company_tags @> ARRAY[:tag]::text[]
            """),
            {"tag": company_tag},
        ).mappings().first()
        return dict(counts) if counts else {"voice_count": 0, "dsa_count": 0, "total": 0}
    except Exception:
        pass

    try:
        # Fallback: try company_tag single column
        counts = db.execute(
            text("""
                SELECT
                    COUNT(*) FILTER (WHERE type = 'voice') AS voice_count,
                    COUNT(*) FILTER (WHERE type = 'code')  AS dsa_count,
                    COUNT(*)                                  AS total
                FROM questions
                WHERE company_tag = :tag
            """),
            {"tag": company_tag},
        ).mappings().first()
        return dict(counts) if counts else {"voice_count": 0, "dsa_count": 0, "total": 0}
    except Exception:
        return {"voice_count": 0, "dsa_count": 0, "total": 0}