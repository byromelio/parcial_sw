# app/routers/realtime.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws_manager import ws_manager

router = APIRouter(prefix="/diagrams", tags=["realtime"])


@router.websocket("/{diagram_id}/ws")
async def websocket_endpoint(websocket: WebSocket, diagram_id: str):
    """
    Canal WebSocket por diagrama.
    Cada cliente que se conecta queda suscrito a eventos en tiempo real
    (clases, atributos, métodos, relaciones).
    """
    await ws_manager.connect(diagram_id, websocket)
    try:
        while True:
            # Si quieres que los clientes puedan mandar mensajes
            # (ej. chat colaborativo), aquí se procesan:
            _ = await websocket.receive_text()
            # Por ahora lo ignoramos. El flujo principal es solo broadcast.
            # Puedes hacer echo si quieres debug:
            # await websocket.send_text(f"Echo: {message}")
    except WebSocketDisconnect:
        ws_manager.disconnect(diagram_id, websocket)
    except Exception:
        # Si hay error, aseguramos desconexión
        ws_manager.disconnect(diagram_id, websocket)
