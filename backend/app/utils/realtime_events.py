 
# app/utils/realtime_events.py
from uuid import UUID
from app.ws_manager import ws_manager
from app.models.uml import Clase, Atributo, Metodo, Relacion
from app.schemas.relacion import RelacionOut


# =========================
# Clases
# =========================
async def notify_class_created(diagram_id: UUID, clase: Clase):
    payload = {
        "event": "class.created",
        "data": {
            "id": str(clase.id),
            "nombre": clase.nombre,
            "x_grid": clase.x_grid,
            "y_grid": clase.y_grid,
            "w_grid": clase.w_grid,
            "h_grid": clase.h_grid,
            "z_index": clase.z_index,
        },
    }
    print("🔔 Evento emitido (Clase Creada):", payload)
    await ws_manager.broadcast(str(diagram_id), payload)


async def notify_class_updated(diagram_id: UUID, clase: Clase):
    payload = {
        "event": "class.updated",
        "data": {
            "id": str(clase.id),
            "nombre": clase.nombre,
            "x_grid": clase.x_grid,
            "y_grid": clase.y_grid,
            "w_grid": clase.w_grid,
            "h_grid": clase.h_grid,
            "z_index": clase.z_index,
        },
    }
    print("🔔 Evento emitido (Clase Actualizada):", payload)
    await ws_manager.broadcast(str(diagram_id), payload)


async def notify_class_deleted(diagram_id: UUID, class_id: UUID):
    payload = {
        "event": "class.deleted",
        "data": {"id": str(class_id)},
    }
    print("🔔 Evento emitido (Clase Eliminada):", payload)
    await ws_manager.broadcast(str(diagram_id), payload)


# =========================
# Atributos
# =========================
async def notify_attribute_created(diagram_id: UUID, atributo: Atributo):
    payload = {
        "event": "attribute.created",
        "data": {
            "id": str(atributo.id),
            "nombre": atributo.nombre,
            "tipo": atributo.tipo,
            "requerido": atributo.requerido,
            "clase_id": str(atributo.clase_id),
        },
    }
    print("🔔 Evento emitido (Atributo Creado):", payload)
    await ws_manager.broadcast(str(diagram_id), payload)


async def notify_attribute_updated(diagram_id: UUID, atributo: Atributo):
    payload = {
        "event": "attribute.updated",
        "data": {
            "id": str(atributo.id),
            "nombre": atributo.nombre,
            "tipo": atributo.tipo,
            "requerido": atributo.requerido,
            "clase_id": str(atributo.clase_id),
        },
    }
    print("🔔 Evento emitido (Atributo Actualizado):", payload)
    await ws_manager.broadcast(str(diagram_id), payload)


async def notify_attribute_deleted(diagram_id: UUID, atributo_id: UUID, clase_id: UUID):
    payload = {
        "event": "attribute.deleted",
        "data": {
            "id": str(atributo_id),
            "clase_id": str(clase_id),},
    }
    print("🔔 Evento emitido (Atributo Eliminado):", payload)
    await ws_manager.broadcast(str(diagram_id), payload)


# =========================
# Métodos
# =========================
async def notify_method_created(diagram_id: UUID, metodo: Metodo):
    payload = {
        "event": "method.created",
        "data": {
            "id": str(metodo.id),
            "nombre": metodo.nombre,
            "tipo_retorno": metodo.tipo_retorno,
            "clase_id": str(metodo.clase_id),
        },
    }
    print("🔔 Evento emitido (Método Creado):", payload)
    await ws_manager.broadcast(str(diagram_id), payload)


async def notify_method_updated(diagram_id: UUID, metodo: Metodo):
    payload = {
        "event": "method.updated",
        "data": {
            "id": str(metodo.id),
            "nombre": metodo.nombre,
            "tipo_retorno": metodo.tipo_retorno,
            "clase_id": str(metodo.clase_id),
        },
    }
    print("🔔 Evento emitido (Método Actualizado):", payload)
    await ws_manager.broadcast(str(diagram_id), payload)


async def notify_method_deleted(diagram_id: UUID, metodo_id: UUID, clase_id: UUID):
    payload = {
        "event": "method.deleted",
        "data": {
            "id": str(metodo_id),
            "clase_id": str(clase_id), },
    }
    print("🔔 Evento emitido (Método Eliminado):", payload)
    await ws_manager.broadcast(str(diagram_id), payload)

# =========================
# Relaciones de realtime_events.py
# =========================
async def notify_relation_created(diagram_id: UUID, relation: RelacionOut):
    payload = {
        "event": "relation.created",
        "data": {
            "id": str(relation.id),
            "diagram_id": str(diagram_id),
            "label": relation.label,  # ✅
            "type": relation.type,
            "from_class": str(relation.from_class),
            "to_class": str(relation.to_class),
            "src_anchor": relation.src_anchor,
            "dst_anchor": relation.dst_anchor,
            "src_offset": relation.src_offset,
            "dst_offset": relation.dst_offset,
            "src_lane": relation.src_lane,
            "dst_lane": relation.dst_lane,
            "src_mult_min": relation.src_mult_min,
            "src_mult_max": relation.src_mult_max,
            "dst_mult_min": relation.dst_mult_min,
            "dst_mult_max": relation.dst_mult_max,
            "origen_nombre": relation.origen_nombre,
            "destino_nombre": relation.destino_nombre,
        },
    }
    print("🔔 Evento emitido (Relación Creada):", payload)
    await ws_manager.broadcast(str(diagram_id), payload)


async def notify_relation_updated(diagram_id: UUID, relation: RelacionOut):
    payload = {
        "event": "relation.updated",
        "data": {
            "id": str(relation.id),
            "diagram_id": str(diagram_id),
            "label": relation.label,  # ✅
            "type": relation.type,
            "src_anchor": relation.src_anchor,
            "dst_anchor": relation.dst_anchor,
            "src_offset": relation.src_offset,
            "dst_offset": relation.dst_offset,
            "src_lane": relation.src_lane,
            "dst_lane": relation.dst_lane,
            "src_mult_min": relation.src_mult_min,
            "src_mult_max": relation.src_mult_max,
            "dst_mult_min": relation.dst_mult_min,
            "dst_mult_max": relation.dst_mult_max,
            "origen_nombre": relation.origen_nombre,
            "destino_nombre": relation.destino_nombre,
        },
    }
    print("🔔 Evento emitido (Relación Actualizada):", payload)
    await ws_manager.broadcast(str(diagram_id), payload)


async def notify_relation_deleted(diagram_id: UUID, relation_id: UUID):
    payload = {
        "event": "relation.deleted",
        # "data": {"id": str(relation_id)},
         "data": {
            "id": str(relation_id),
            "diagram_id": str(diagram_id),
            },
    }
    print("🔔 Evento emitido (Relación Eliminada):", payload)
    await ws_manager.broadcast(str(diagram_id), payload)
