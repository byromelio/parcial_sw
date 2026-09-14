# app/routers/ai.py
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.ai import AiCommandIn, AiCommandOut
from app.services.ai_assistant import run_command
from ._helpers import get_my_diagram

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/diagrams", tags=["ai"])


@router.post("/{diagram_id}/ai/command", response_model=AiCommandOut)
def ai_command(
    diagram_id: UUID,
    body: AiCommandIn,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    diagram = get_my_diagram(db, me, diagram_id)
    logger.info(f"🎤 [AI COMMAND] diagram_id={diagram_id}, user={me.id}, text={body.text!r}")

    try:
        result = run_command(db, diagram, body.text)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return AiCommandOut(reply=result.reply, actions=result.actions)
