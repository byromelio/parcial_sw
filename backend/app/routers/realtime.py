# app/routers/realtime.py
import json
import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError

from app.core.security import decode_token
from app.db import SessionLocal
from app.models.uml import Diagram
from app.models.user import User
from app.services.locks import lock_manager
from app.ws_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/diagrams", tags=["realtime"])


def _authenticate(token: str | None, diagram_id: str) -> str | None:
    """Valida el token y que el diagrama exista y le pertenezca al usuario.
    Devuelve el email si esta todo bien, None si hay que rechazar la conexion.

    El WebSocket nativo del navegador no permite mandar headers custom, asi
    que el token viaja por query string (?token=...) en vez del header
    Authorization que usa el resto de la API.
    """
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get("kind") != "access":
            return None
        email = payload.get("sub")
        if not email:
            return None
    except JWTError:
        return None

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).one_or_none()
        if not user or not user.active:
            return None
        try:
            diag_uuid = UUID(diagram_id)
        except ValueError:
            return None
        diagram = (
            db.query(Diagram)
            .filter(Diagram.id == diag_uuid, Diagram.owner_id == user.id)
            .one_or_none()
        )
        if not diagram:
            return None
        return email
    finally:
        db.close()


@router.websocket("/{diagram_id}/ws")
async def websocket_endpoint(websocket: WebSocket, diagram_id: str):
    """
    Canal WebSocket por diagrama: broadcast de cambios en tiempo real
    (clases, atributos, metodos, relaciones, progreso del asistente de IA)
    y protocolo de exclusion mutua a nivel de clase.

    Mensajes que puede mandar el cliente:
      {"action": "lock",   "class_id": "..."}
      {"action": "unlock", "class_id": "..."}

    Eventos que puede recibir:
      connected      -> {conn_id}                                (al conectarse, primero que nada)
      locks.snapshot -> {class_id: {email, conn_id}, ...}         (al conectarse)
      class.locked   -> {class_id, email, conn_id}
      class.unlocked -> {class_id}
      lock.denied    -> {class_id, locked_by, locked_by_conn_id}  (solo al que lo pidio)

    `conn_id` identifica la CONEXION (no al usuario): dos pestañas de la
    misma persona son dos conn_id distintos. Es lo que el frontend usa para
    saber si el lock es "mio" o "de otro", porque compararlo por email
    fallaba justo en el caso mas obvio -- la misma persona con dos pestañas
    abiertas nunca se bloqueaba a si misma, porque "el lock es de
    ad1@example.com" y esa pestaña TAMBIEN es ad1@example.com.
    """
    token = websocket.query_params.get("token")
    email = _authenticate(token, diagram_id)
    if email is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    conn_id = str(id(websocket))
    await ws_manager.connect(diagram_id, websocket)
    await websocket.send_json({"event": "connected", "data": {"conn_id": conn_id}})
    await websocket.send_json({
        "event": "locks.snapshot",
        "data": lock_manager.snapshot(diagram_id),
    })

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except ValueError:
                continue

            action = msg.get("action")
            class_id = msg.get("class_id")
            if not action or not class_id:
                continue

            if action == "lock":
                if lock_manager.acquire(diagram_id, class_id, email, websocket):
                    await ws_manager.broadcast(diagram_id, {
                        "event": "class.locked",
                        "data": {"class_id": class_id, "email": email, "conn_id": conn_id},
                    })
                else:
                    info = lock_manager.info(diagram_id, class_id)
                    await websocket.send_json({
                        "event": "lock.denied",
                        "data": {
                            "class_id": class_id,
                            "locked_by": info.email if info else None,
                            "locked_by_conn_id": str(id(info.ws)) if info else None,
                        },
                    })

            elif action == "unlock":
                if lock_manager.release(diagram_id, class_id, websocket):
                    await ws_manager.broadcast(diagram_id, {
                        "event": "class.unlocked",
                        "data": {"class_id": class_id},
                    })

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception(f"[realtime] error en el socket del diagrama {diagram_id}")
    finally:
        ws_manager.disconnect(diagram_id, websocket)
        released = lock_manager.release_all_for(diagram_id, websocket)
        for class_id in released:
            await ws_manager.broadcast(diagram_id, {
                "event": "class.unlocked",
                "data": {"class_id": class_id},
            })
