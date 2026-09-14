# app/routers/diagramas.py
# POST
# http://localhost:8000/diagrams
# {
#   "title": "Mi primer diagrama"
# } 
# GET
# http://localhost:8000/diagrams?page=1&limit=20
from uuid import UUID
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.uml import Clase, Relacion
from app.models.uml import Diagram
from app.schemas.diagram import DiagramCreate, DiagramOut, DiagramList
from app.schemas.clase_completa import ClaseCompletaOut, ClaseCompletaOutLight,RelacionOutExpanded
 
from ._helpers import get_my_diagram

router = APIRouter(prefix="/diagrams", tags=["diagrams"])
log = logging.getLogger("app.routers.diagramas")


@router.post("", response_model=DiagramOut, status_code=status.HTTP_201_CREATED)
def create_diagram(
    body: DiagramCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    log.info(f"➕ Crear diagrama -> user_id={me.id}, title={body.title}")
    d = Diagram(title=body.title, owner_id=me.id)
    db.add(d); db.commit(); db.refresh(d)
    log.debug(f"✅ Diagrama creado -> id={d.id}, title={d.title}")
    return d


@router.get("", response_model=DiagramList)
def list_diagrams(
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if page < 1: page = 1
    if limit < 1: limit = 20

    log.info(f"📥 Listar diagramas -> user_id={me.id}, page={page}, limit={limit}")

    q = db.query(Diagram).filter(Diagram.owner_id == me.id).order_by(Diagram.updated_at.desc())
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()

    log.debug(f"✅ {len(items)} diagramas obtenidos de un total de {total}")
    return DiagramList(items=items, page=page, limit=limit, total=total)


@router.get("/{diagram_id}", response_model=DiagramOut)
def get_diagram(
    diagram_id: UUID,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    log.info(f"🔍 Obtener diagrama -> user_id={me.id}, diagram_id={diagram_id}")
    d = db.query(Diagram).filter(Diagram.id == diagram_id, Diagram.owner_id == me.id).one_or_none()
    if not d:
        log.warning(f"⚠️ Diagrama no encontrado -> diagram_id={diagram_id}, user_id={me.id}")
        raise HTTPException(404, "Diagrama no encontrado")
    log.debug(f"✅ Diagrama encontrado -> id={d.id}, title={d.title}")
    return d


@router.delete("/{diagram_id}", status_code=204)
def delete_diagram(
    diagram_id: UUID,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    log.info(f"🗑️ Eliminar diagrama -> user_id={me.id}, diagram_id={diagram_id}")
    d = db.query(Diagram).filter(Diagram.id == diagram_id, Diagram.owner_id == me.id).one_or_none()
    if not d:
        log.warning(f"⚠️ Intento de eliminar diagrama inexistente -> diagram_id={diagram_id}, user_id={me.id}")
        raise HTTPException(404, "Diagrama no encontrado")

    db.delete(d); db.commit()
    log.debug(f"✅ Diagrama eliminado -> id={diagram_id}, user_id={me.id}")
    return


@router.get("/{diagram_id}/full", response_model=dict)
def get_diagram_full(
    diagram_id: UUID,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    d = get_my_diagram(db, me, diagram_id)

    # Todas las clases con atributos y métodos
    clases = db.query(Clase).filter(Clase.diagram_id == d.id).all()
    clases_out = [ClaseCompletaOut.model_validate(c) for c in clases]

    # Todas las relaciones expandidas
    relaciones = db.query(Relacion).filter(Relacion.diagram_id == d.id).all()
    relaciones_out = []
    for r in relaciones:
        relaciones_out.append(
            RelacionOutExpanded.model_validate({
                **r.__dict__,
                "origen": ClaseCompletaOutLight.model_validate(r.origen),
                "destino": ClaseCompletaOutLight.model_validate(r.destino),
            })
        )

    return {
        "id": str(d.id),
        "title": d.title,
        "clases": clases_out,
        "relaciones": relaciones_out
    }
