# backend/api/promo_admin.py
"""
Admin endpoints for the Founding 50 applications.
Reuses the exact admin check from api/admin.py (is_superuser).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.admin import _get_db, _require_admin

router = APIRouter(prefix="/api/admin/promo", tags=["admin-promo"])

SETTABLE = {"applied", "accepted", "waitlist", "rejected"}
ALL_STATUSES = SETTABLE | {"joined"}
CODE = "FOUNDING50"


class StatusBody(BaseModel):
    status: str


@router.get("/applications")
def list_applications(
    status: Optional[str] = Query(None),
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    if status and status not in ALL_STATUSES:
        raise HTTPException(status_code=400, detail="invalid_status")

    params: dict = {}
    where = ""
    if status:
        where = "WHERE status = :s"
        params["s"] = status

    rows = db.execute(
        text(f"""
            SELECT id, name, email, college, city, branch, year, next_test,
                   current_prep, whatsapp, agreed_feedback, agreed_contact,
                   status, notes, created_at
            FROM founding_applications
            {where}
            ORDER BY created_at DESC
            LIMIT 500
        """),
        params,
    ).mappings().all()

    counts_raw = db.execute(
        text("SELECT status, COUNT(*) AS c FROM founding_applications GROUP BY status")
    ).mappings().all()
    counts = {s: 0 for s in ALL_STATUSES}
    for r in counts_raw:
        counts[r["status"]] = int(r["c"])

    code = db.execute(
        text("SELECT max_uses, uses FROM promo_codes WHERE code = :c"),
        {"c": CODE},
    ).mappings().first()
    spots_left = (code["max_uses"] - code["uses"]) if code else 0

    items = []
    for r in rows:
        d = dict(r)
        d["created_at"] = d["created_at"].isoformat() if d.get("created_at") else None
        items.append(d)

    return {
        "items": items,
        "counts": counts,
        "spots_left": spots_left,
        "max_uses": code["max_uses"] if code else 0,
        "code": CODE,
    }


@router.post("/applications/{app_id}/status")
def set_status(
    app_id: int,
    body: StatusBody,
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    if body.status not in SETTABLE:
        raise HTTPException(status_code=400, detail="invalid_status")

    # 'joined' is set automatically on redeem and must never be overwritten
    row = db.execute(
        text("""
            UPDATE founding_applications
            SET status = :s
            WHERE id = :id AND status <> 'joined'
            RETURNING id, status
        """),
        {"s": body.status, "id": app_id},
    ).mappings().first()
    db.commit()

    if not row:
        raise HTTPException(status_code=404, detail="not_found_or_already_joined")
    return {"id": row["id"], "status": row["status"]}