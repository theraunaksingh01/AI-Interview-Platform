from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from db.session import get_db
from api.deps import get_current_user
from models.responses import Responses
from schemas.responses import ResponseCreate

router = APIRouter()

@router.post("/responses")
def create_response(data: ResponseCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    response = Responses(
        interview_id=str(data.interview_id),
        video_file_path=data.video_file_path,
    )
    db.add(response)
    db.commit()
    db.refresh(response)
    return {"message": "response saved", "response_id": str(response.id)}

