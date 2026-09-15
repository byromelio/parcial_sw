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

# El SDK de Gemini (google-genai) expone su jerarquia de excepciones de la
# API de "interactions" desde un modulo interno (google.genai._gaos...),
# no desde google.genai.errors -- e importar un modulo con "_" es fragil
# entre versiones. Clasificamos por el NOMBRE de la clase de excepcion en
# vez de importarla directamente; los nombres (AuthenticationError,
# RateLimitError, etc.) siguen la convencion estandar de SDKs de IA.
_ERROR_MAP: dict[str, tuple[int, str]] = {
    "authenticationerror": (502, "La API key de Gemini configurada no es válida."),
    "permissiondeniederror": (502, "La API key de Gemini no tiene permiso para este modelo."),
    "ratelimiterror": (429, "Se alcanzó el límite de uso gratuito de la API de Gemini. Esperá un momento y reintentá."),
    "notfounderror": (502, "El modelo de Gemini configurado no existe o no está disponible."),
    "badrequesterror": (502, "Gemini rechazó la solicitud (parámetros inválidos)."),
    "apitimeouterror": (504, "Gemini tardó demasiado en responder. Reintentá el comando."),
    "apiconnectionerror": (502, "No se pudo conectar con la API de Gemini. Revisá tu conexión a internet."),
    "internalservererror": (502, "Error del servidor de Gemini, reintentá en unos segundos."),
}


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
    except Exception as e:
        key = type(e).__name__.lower()
        if key in _ERROR_MAP:
            status_code, detail = _ERROR_MAP[key]
            logger.warning(f"⚠️ [AI COMMAND] {type(e).__name__}: {e}")
            raise HTTPException(status_code=status_code, detail=detail)
        logger.error(f"❌ [AI COMMAND] error inesperado: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Error inesperado del asistente de IA: {e}")

    return AiCommandOut(reply=result.reply, actions=result.actions)
