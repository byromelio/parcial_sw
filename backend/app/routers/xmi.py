# app/routers/xmi.py
"""
Interoperabilidad con Enterprise Architect via XMI (requisito de la catedra).

- GET  /diagrams/{id}/export-xmi  -> descarga el diagrama como .xmi
- POST /diagrams/{id}/import-xmi  -> sube un .xmi y lo mezcla en el diagrama

El import reusa DiagramToolExecutor (el mismo motor que usa el asistente de
IA): asi cada clase/atributo/relacion creada dispara la misma notificacion
por WebSocket que una edicion manual, y la validacion de nombres duplicados
es una sola implementacion en vez de tres.
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.core.security import get_current_user
from app.models.uml import Relacion
from app.models.user import User
from app.schemas.xmi import XmiImportSummary
from app.services.ai_tools import DiagramToolExecutor, ToolError
from app.services.xmi import GRID_PX, InvalidXmiError, UnsupportedXmiError, build_xmi, parse_xmi
from ._helpers import get_my_diagram

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/diagrams", tags=["xmi"])


def _mult_str(lo: int, hi: int | None) -> str:
    if hi is None:
        return f"{lo}..*"
    if lo == hi:
        return str(lo)
    return f"{lo}..{hi}"


@router.get("/{diagram_id}/export-xmi")
def export_xmi(
    diagram_id: UUID,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    diagram = get_my_diagram(db, me, diagram_id)
    xml_bytes = build_xmi(diagram)
    filename = f"{diagram.title or 'diagrama'}.xmi".replace(" ", "_")
    return Response(
        content=xml_bytes,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{diagram_id}/import-xmi", response_model=XmiImportSummary)
async def import_xmi(
    diagram_id: UUID,
    file: UploadFile,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    diagram = get_my_diagram(db, me, diagram_id)
    content = await file.read()

    try:
        parsed = parse_xmi(content)
    except InvalidXmiError as e:
        raise HTTPException(400, {"detail": str(e), "code": "invalid_xmi"}) from e
    except UnsupportedXmiError as e:
        raise HTTPException(400, {"detail": str(e), "code": "unsupported_xmi"}) from e

    executor = DiagramToolExecutor(db, diagram)
    summary = XmiImportSummary(warnings=list(parsed.warnings))

    # --- Clases + atributos ---
    # Si el XMI trae posicion de diagrama (extension de EA), se respeta
    # esa posicion (convertida de pixeles a celdas de grilla) en vez de
    # apilar todo con una grilla generica -- asi un archivo exportado por
    # este mismo sistema, editado en EA y reimportado, conserva el layout
    # que el usuario armo en EA. Si el XMI no trae posiciones (ej. viene de
    # otra herramienta), se cae a la grilla de siempre.
    COLS, COL_W, ROW_H = 3, 18, 16
    for idx, ic in enumerate(parsed.classes):
        if ic.x is not None and ic.y is not None:
            x_grid, y_grid = ic.x // GRID_PX, ic.y // GRID_PX
        else:
            x_grid, y_grid = (idx % COLS) * COL_W, (idx // COLS) * ROW_H
        try:
            executor.create_class(name=ic.name, x_grid=x_grid, y_grid=y_grid)
            summary.classes_created.append(ic.name)
        except ToolError:
            summary.classes_skipped.append(ic.name)  # ya existia en el diagrama

        for attr in ic.attributes:
            try:
                executor.add_attribute(
                    class_name=ic.name, name=attr.name, type=attr.type, required=attr.required,
                )
                summary.attributes_created += 1
            except ToolError as e:
                summary.attributes_skipped += 1
                logger.info(f"[XMI import] atributo omitido: {e}")

    # --- Relaciones ---
    # DiagramToolExecutor.create_relation no chequea duplicados a proposito:
    # el asistente de IA puede querer una segunda relacion (distinto tipo)
    # entre las mismas dos clases, y eso es UML valido. Pero reimportar el
    # mismo XMI dos veces sobre el mismo diagrama tiene que ser idempotente,
    # asi que ese chequeo va aca, especifico del import.
    existentes = set()
    for r in db.query(Relacion).filter(Relacion.diagram_id == diagram.id).all():
        existentes.add((r.origen.nombre.lower(), r.destino.nombre.lower(), r.tipo.value))

    for ir in parsed.relations:
        key = (ir.from_name.strip().lower(), ir.to_name.strip().lower(), ir.type)
        if key in existentes:
            summary.relations_skipped += 1
            continue
        try:
            executor.create_relation(
                from_class=ir.from_name,
                to_class=ir.to_name,
                type=ir.type,
                label=ir.label,
                src_multiplicity=_mult_str(ir.src_mult_min, ir.src_mult_max),
                dst_multiplicity=_mult_str(ir.dst_mult_min, ir.dst_mult_max),
            )
            summary.relations_created += 1
        except ToolError as e:
            summary.relations_skipped += 1
            summary.warnings.append(str(e))

    logger.info(
        f"[XMI import] diagram_id={diagram_id} "
        f"clases={len(summary.classes_created)} atributos={summary.attributes_created} "
        f"relaciones={summary.relations_created}"
    )
    return summary
