from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.user import User
from app.models.uml import Diagram, Clase

def get_my_diagram(db: Session, me: User, diagram_id: UUID) -> Diagram:
    d = db.query(Diagram).filter(Diagram.id == diagram_id, Diagram.owner_id == me.id).one_or_none()
    if not d:
        raise HTTPException(404, "Diagrama no encontrado")
    return d

def get_my_class(db: Session, me: User, class_id: UUID) -> Clase:
    q = (
        db.query(Clase)
        .join(Diagram, Diagram.id == Clase.diagram_id)
        .filter(Clase.id == class_id, Diagram.owner_id == me.id)
    )
    c = q.one_or_none()
    if not c:
        raise HTTPException(404, "Clase no encontrada")
    return c
