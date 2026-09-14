
# app/routers/atributos.py
from uuid import UUID
import logging, asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.uml import Atributo, Clase, Diagram
from app.schemas.atributo import AtributoCreate, AtributoUpdate, AtributoOut
from ._helpers import get_my_class
from app.utils import realtime_events

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/diagrams", tags=["attributes"])


# 🔹 Listar atributos
@router.get("/classes/{class_id}/attributes", response_model=list[AtributoOut])
def list_attributes(
    class_id: UUID,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    logger.info(f"📥 [LIST] atributos -> class_id={class_id}, user={me.id}")
    c = get_my_class(db, me, class_id)
    items = db.query(Atributo).filter(Atributo.clase_id == c.id).all()
    logger.info(f"✅ {len(items)} atributos encontrados en class_id={class_id}")
    return [AtributoOut(id=i.id, name=i.nombre, type=i.tipo, required=i.requerido) for i in items]


# 🔹 Crear atributo
@router.post("/classes/{class_id}/attributes", response_model=AtributoOut, status_code=status.HTTP_201_CREATED)
async def create_attribute(
    class_id: UUID,
    body: AtributoCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    logger.info(f"➕ [CREATE] atributo -> class_id={class_id}, user={me.id}, body={body}")
    c = get_my_class(db, me, class_id)

    try:
        a = Atributo(nombre=body.name, tipo=body.type, requerido=bool(body.required), clase_id=c.id)
        db.add(a); db.commit(); db.refresh(a)
        logger.info(f"✅ Atributo creado -> attr_id={a.id}, class_id={c.id}")

        # 🔔 Notificar en tiempo real
        asyncio.create_task(realtime_events.notify_attribute_created(c.diagram_id, a))
        asyncio.create_task(realtime_events.notify_class_updated(c.diagram_id, c))
        return AtributoOut(id=a.id, name=a.nombre, type=a.tipo, required=a.requerido)
    except Exception as e:
        logger.error(f"❌ Error creando atributo -> class_id={class_id}, user={me.id}, error={str(e)}")
        raise


# 🔹 Actualizar atributo
@router.patch("/attributes/{attr_id}", response_model=AtributoOut)
async def update_attribute(
    attr_id: UUID,
    body: AtributoUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    logger.info(f"✏️ [UPDATE] atributo -> attr_id={attr_id}, user={me.id}, body={body}")
    a = (
        db.query(Atributo)
        .join(Clase, Clase.id == Atributo.clase_id)
        .join(Diagram, Diagram.id == Clase.diagram_id)
        .filter(Atributo.id == attr_id, Diagram.owner_id == me.id)
        .one_or_none()
    )
    if not a:
        logger.warning(f"⚠️ Atributo no encontrado -> attr_id={attr_id}, user={me.id}")
        raise HTTPException(404, "Atributo no encontrado")

    try:
        if body.name is not None: a.nombre = body.name
        if body.type is not None: a.tipo = body.type
        if body.required is not None: a.requerido = body.required

        db.commit(); db.refresh(a)
        c = a.clase
        logger.info(f"✅ Atributo actualizado -> attr_id={a.id}, class_id={c.id}")

        # 🔔 Notificar en tiempo real
        asyncio.create_task(realtime_events.notify_attribute_updated(c.diagram_id, a))
        asyncio.create_task(realtime_events.notify_class_updated(c.diagram_id, c))
        return AtributoOut(id=a.id, name=a.nombre, type=a.tipo, required=a.requerido)
    except Exception as e:
        logger.error(f"❌ Error actualizando atributo -> attr_id={attr_id}, error={str(e)}")
        raise


# 🔹 Eliminar atributo
@router.delete("/attributes/{attr_id}", response_model=dict)
async def delete_attribute(
    attr_id: UUID,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    logger.info(f"🗑️ [DELETE] atributo -> attr_id={attr_id}, user={me.id}")
    a = (
        db.query(Atributo)
        .join(Clase, Clase.id == Atributo.clase_id)
        .join(Diagram, Diagram.id == Clase.diagram_id)
        .filter(Atributo.id == attr_id, Diagram.owner_id == me.id)
        .one_or_none()
    )
    if not a:
        logger.warning(f"⚠️ Atributo no encontrado -> attr_id={attr_id}, user={me.id}")
        raise HTTPException(404, "Atributo no encontrado")

    try:
        c = a.clase
        attr_id = a.id
        db.delete(a); db.commit()
        logger.info(f"✅ Atributo eliminado -> attr_id={attr_id}, class_id={c.id}")

        # 🔔 Notificar en tiempo real
        asyncio.create_task(realtime_events.notify_attribute_deleted(c.diagram_id,  attr_id, c.id))
        asyncio.create_task(realtime_events.notify_class_updated(c.diagram_id, c))
        return {"id": str(attr_id), "class_id": str(c.id)}
    except Exception as e:
        logger.error(f"❌ Error eliminando atributo -> attr_id={attr_id}, error={str(e)}")
        raise
