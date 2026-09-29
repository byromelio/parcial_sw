# app/services/xmi.py
"""
Interoperabilidad XMI con Enterprise Architect (requisito de la catedra:
"la herramienta se deberia poder integrar con el Architect sin mayor
problema, ya sea importando o exportando... generalmente se utiliza un
mecanismo basado en XMI, que es una especializacion de XML").

Dos dialectos de XMI, un unico modelo neutro. IMPORTANTE, porque esto
confundio una version anterior de este archivo: hay DOS conceptos
distintos, no uno, que se llaman parecido:

- "XMI 2.1" (namespace xmi:/uml: con prefijo de dos puntos,
  xmi:version="2.1"): es lo que un Enterprise Architect real EXPORTA por
  defecto (Publish > Export Package to XMI) y lo que su funcion
  "Import Package from XML" espera recibir. Es el dialecto PRIMARIO de
  esta integracion -- tanto el LECTOR (_parse_xmi21) como el ESCRITOR
  (build_xmi) fueron escritos leyendo tag por tag un archivo .xmi real
  exportado desde un EA real (prueba.xmi, 3 clases + 2 asociaciones +
  diagrama). El lector se corrio contra ese archivo real y funciona. El
  escritor todavia NO SE REIMPORTO en un EA real para confirmar que el
  diagrama aparece poblado -- es el siguiente paso pendiente antes de dar
  por cerrado el problema original de esta integracion.
- "XMI 1.1" (un dialecto MAS VIEJO, con xmi.version como atributo plano y
  <XMI.content> como contenedor): NO es lo que EA usa para exportar ni
  para "Import Package from XML". Solo se descubrio su existencia porque
  la funcion "Merge Model XMI into Current Package" de EA lo exige
  explicitamente y devuelve el error literal "Invalid Enterprise Architect
  XMI 1.1 file" al recibir un XMI 2.1 -- pero esta integracion no usa
  Merge, asi que este dialecto queda como lector secundario, sin verificar
  contra un archivo real, por si algun archivo asi aparece.

Ambos lectores llenan la MISMA estructura intermedia (ImportResult), asi
que el mapeo a modelo-de-base-de-datos vive en un solo lugar (el router),
sin importar que dialecto se detecto.

Import defensivo a proposito: preferimos importar clases/atributos/
relaciones de forma best-effort, devolviendo warnings por cada cosa que no
se pudo resolver, en vez de rechazar el archivo entero por un detalle que
no podemos resolver. Solo dos motivos paran el import por completo (ver
InvalidXmiError / UnsupportedXmiError mas abajo): el XML esta mal formado
o excede el tamano permitido, o no contiene ningun modelo UML reconocible.

LIMITACION CONOCIDA, no oculta: el modelo del proyecto ya tiene el
concepto de "clase de asociacion" (Relacion.es_clase_asociacion, para
muchos-a-muchos con atributos propios), y en teoria EA representa lo mismo
con un tag "associationclass" en la Association mas un tag reverso en la
Class. Pero prueba.xmi (el unico archivo real de EA disponible para
verificar) no tenia ninguna clase de asociacion, asi que el formato EXACTO
de esos tags nunca se confirmo contra un EA real. _parse_xmi1_legacy tiene
un mecanismo de deteccion (_SYNTHETIC_TAG) basado en la mejor suposicion
del estandar UML, pero NO esta portado a _parse_xmi21 (el lector primario)
porque hacerlo sin verificacion podria descartar silenciosamente clases
reales del usuario. Antes de confiar en esto, habria que exportar una
clase de asociacion real desde EA e inspeccionar el XMI resultante, igual
que se hizo con prueba.xmi para el resto de este modulo.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from xml.etree import ElementTree as ET

from defusedxml.ElementTree import fromstring as safe_fromstring
from defusedxml.common import DefusedXmlException

from app.models.uml import RelType

XMI_NS = "http://schema.omg.org/spec/XMI/2.1"
UML_NS = "http://schema.omg.org/spec/UML/2.1"
NS = {"xmi": XMI_NS, "uml": UML_NS}

ET.register_namespace("xmi", XMI_NS)
ET.register_namespace("uml", UML_NS)

# Limite de tamano de subida, antes de intentar parsear nada: un XMI de un
# diagrama de clases normal pesa unos pocos KB a lo sumo, asi que 5 MB ya
# es generoso y corta de raiz cualquier intento de agotar memoria con un
# archivo gigante disfrazado de .xmi.
MAX_XMI_BYTES = 5 * 1024 * 1024

# Tag reverso que marca una clase de asociacion generada por ESTE
# exportador (ver seccion "Export" para el detalle completo del mecanismo).
_SYNTHETIC_TAG = "parcial_sw:synthetic_association_class"


class InvalidXmiError(Exception):
    """XML mal formado, vacio, o que excede el tamano permitido."""


class UnsupportedXmiError(Exception):
    """XML bien formado pero sin ningun modelo UML reconocible (ni el
    lector XMI 2.1 ni el lector legacy XMI 1.1 detectaron una sola clase)."""


# UML primitive types estandar (los entiende cualquier herramienta UML2 sin
# resolver nada mas: se referencian por href, no hace falta definirlos).
_PRIMITIVE_HREF = "http://schema.omg.org/spec/UML/2.1/uml.xml#{name}"
_TO_UML_PRIMITIVE = {
    "int": "Integer", "integer": "Integer", "long": "Integer",
    "float": "Real", "double": "Real", "decimal": "Real",
    "boolean": "Boolean", "bool": "Boolean",
    "string": "String", "text": "String", "uuid": "String", "email": "String",
}
# Tipos sin primitivo UML estandar: se declaran como uml:DataType propios
# dentro del mismo archivo, asi el XMI queda autocontenido.
_LOCAL_DATATYPES = {"date": "Date", "datetime": "DateTime"}

# Vuelta: nombre de primitivo/datatype UML (en minuscula) -> tipo interno.
# Escrito explicito, no derivado de _TO_UML_PRIMITIVE: ese dict tiene varias
# claves internas apuntando al mismo primitivo UML (int/integer/long ->
# Integer), asi que invertirlo automaticamente pierde informacion sobre cual
# es el nombre "canonico" a usar de vuelta.
_FROM_UML_PRIMITIVE = {"integer": "int", "real": "float", "boolean": "boolean", "string": "string", "int": "int"}
_FROM_LOCAL_DATATYPE = {"date": "date", "datetime": "datetime"}

_AGGREGATION_BY_TYPE = {
    RelType.COMPOSITION: "composite",
    RelType.AGGREGATION: "shared",
    RelType.ASSOCIATION: "none",
}
_TYPE_BY_AGGREGATION = {v: k for k, v in _AGGREGATION_BY_TYPE.items()}

# Grilla de layout: misma unidad que usa el editor web (celdas), escalada a
# las unidades de "geometry"/"bounds" que EA espera en el diagrama.
GRID_PX = 20


def _mult(value: int | None) -> str:
    return "*" if value is None else str(value)


# =====================================================================
# Estructura neutra (comun a los dos dialectos de import, y usada tambien
# como forma de pensar el export)
# =====================================================================
@dataclass
class ImportedAttribute:
    name: str
    type: str
    required: bool = False


@dataclass
class ImportedClass:
    xmi_id: str
    name: str
    attributes: list[ImportedAttribute] = field(default_factory=list)
    x: int | None = None
    y: int | None = None
    w: int | None = None
    h: int | None = None
    # True si esta clase estaba marcada con el tag sintetico de asociacion
    # (ver _SYNTHETIC_TAG) Y no tiene atributos propios: el import la
    # descarta en ese caso, porque es la re-materializacion de una
    # relacion muchos-a-muchos, no una entidad que el usuario haya creado
    # a proposito. Si el usuario SI le agrego atributos/operaciones en EA,
    # se respeta como clase real (isSynthetic queda True igual, pero el
    # router la trata como clase real por tener attributes no vacio).
    is_synthetic_association: bool = False


@dataclass
class ImportedRelation:
    from_name: str
    to_name: str
    type: str
    label: str | None = None
    src_mult_min: int = 1
    src_mult_max: int | None = 1
    dst_mult_min: int = 1
    dst_mult_max: int | None = 1


@dataclass
class ImportResult:
    classes: list[ImportedClass] = field(default_factory=list)
    relations: list[ImportedRelation] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    dialect: str = "unknown"  # "xmi2.1" | "xmi1.1-legacy", solo informativo para logs


def _local(tag: str) -> str:
    """'{ns}Class' -> 'Class' (para no depender de que el prefijo sea exactamente uml:)."""
    return tag.rsplit("}", 1)[-1]


# =====================================================================
# Export: modelo -> XMI 2.1 (xmi:Model type="uml:Model" con packagedElement
# anidados, prefijo de dos puntos -- ver docstring del modulo para por que
# NO es XMI 1.1).
#
# La ESTRUCTURA que replica esta funcion (xmi:Documentation, uml:Model con
# packagedElement anidados para Package/Class/Association, y la extension
# propietaria xmi:Extension extender="Enterprise Architect" con
# <elements> + <diagrams><diagram><elements><element geometry="..."
# subject="..."/></elements></diagram></diagrams>) esta tomada de un
# archivo .xmi real exportado directamente desde un Enterprise Architect
# real ("Publish > Export Package to XMI" sobre un paquete de prueba con
# 3 clases). PENDIENTE DE VERIFICAR: todavia no se reimporto la salida de
# ESTA funcion en un EA real -- antes de confiar en que el diagrama
# aparece poblado sin intervencion manual, hay que probarlo con un archivo
# generado por este mismo codigo, no asumirlo por analogia con la
# plantilla de referencia.
# =====================================================================
def build_xmi(diagram) -> bytes:
    """Genera XMI 2.1 (namespace xmi:/uml:, prefijo de dos puntos), el
    dialecto que un Enterprise Architect real efectivamente exporta (ver
    prueba.xmi, releido tag por tag para escribir esta funcion -- no es
    XMI 1.1: ese formato solo lo exige la funcion "Merge" de EA, una
    funcionalidad distinta de "Import Package from XML")."""

    # IDs con el mismo formato (con guiones, prefijo C_/A_/AS_/E1_/E2_) que
    # el archivo confirmado funcionando en un EA real -- una version previa
    # de esta funcion los cambio a "EAID_" sin guiones y el import dejo de
    # colocar las clases en el diagrama; revertido a proposito, no se
    # identifico con certeza cual de los dos cambios (formato de id vs los
    # demas de abajo) era la causa real, asi que se igualo todo.
    classes = list(diagram.classes)
    class_ids = {c.id: f"C_{c.id}" for c in classes}
    used_datatypes: set[str] = set()

    xmi_root = ET.Element(f"{{{XMI_NS}}}XMI", {f"{{{XMI_NS}}}version": "2.1"})

    model_el = ET.SubElement(xmi_root, f"{{{UML_NS}}}Model", {
        f"{{{XMI_NS}}}type": "uml:Model", f"{{{XMI_NS}}}id": "model_1", "name": "EA_Model",
    })

    package_id = "PKG_root"
    package_el = ET.SubElement(model_el, "packagedElement", {
        f"{{{XMI_NS}}}type": "uml:Package",
        f"{{{XMI_NS}}}id": package_id,
        "name": diagram.title or "diagram",
    })

    for c in classes:
        class_el = ET.SubElement(package_el, "packagedElement", {
            f"{{{XMI_NS}}}type": "uml:Class",
            f"{{{XMI_NS}}}id": class_ids[c.id],
            "name": c.nombre,
        })
        for a in c.atributos:
            tipo = (a.tipo or "string").strip().lower()
            attr_el = ET.SubElement(class_el, "ownedAttribute", {
                f"{{{XMI_NS}}}type": "uml:Property",
                f"{{{XMI_NS}}}id": f"A_{a.id}",
                "name": a.nombre,
                "visibility": "private",
            })
            if tipo in _LOCAL_DATATYPES:
                used_datatypes.add(tipo)
                ET.SubElement(attr_el, "type", {f"{{{XMI_NS}}}idref": f"DT_{tipo}"})
            else:
                ET.SubElement(attr_el, "type", {
                    f"{{{XMI_NS}}}type": "uml:PrimitiveType",
                    "href": _PRIMITIVE_HREF.format(name=_TO_UML_PRIMITIVE.get(tipo, "String")),
                })

        for r in c.outgoing_relations:
            if r.tipo == RelType.INHERITANCE:
                ET.SubElement(class_el, "generalization", {
                    f"{{{XMI_NS}}}id": f"G_{r.id}",
                    "general": class_ids[r.destino_id],
                })

    for tipo in sorted(used_datatypes):
        ET.SubElement(package_el, "packagedElement", {
            f"{{{XMI_NS}}}type": "uml:DataType",
            f"{{{XMI_NS}}}id": f"DT_{tipo}",
            "name": _LOCAL_DATATYPES[tipo],
        })

    for r in diagram.relations:
        if r.tipo == RelType.INHERITANCE:
            continue  # ya se exporto como generalization dentro de la clase hija

        if r.tipo == RelType.DEPENDENCY:
            ET.SubElement(package_el, "packagedElement", {
                f"{{{XMI_NS}}}type": "uml:Dependency",
                f"{{{XMI_NS}}}id": f"D_{r.id}",
                "client": class_ids[r.origen_id],
                "supplier": class_ids[r.destino_id],
                **({"name": r.etiqueta} if r.etiqueta else {}),
            })
            continue

        assoc_el = ET.SubElement(package_el, "packagedElement", {
            f"{{{XMI_NS}}}type": "uml:Association",
            f"{{{XMI_NS}}}id": f"AS_{r.id}",
            **({"name": r.etiqueta} if r.etiqueta else {}),
        })
        ET.SubElement(assoc_el, "memberEnd", {f"{{{XMI_NS}}}idref": f"E1_{r.id}"})
        ET.SubElement(assoc_el, "memberEnd", {f"{{{XMI_NS}}}idref": f"E2_{r.id}"})

        end1 = ET.SubElement(assoc_el, "ownedEnd", {
            f"{{{XMI_NS}}}type": "uml:Property",
            f"{{{XMI_NS}}}id": f"E1_{r.id}",
            "type": class_ids[r.origen_id],
            "aggregation": "none",
        })
        ET.SubElement(end1, "lowerValue", {f"{{{XMI_NS}}}type": "uml:LiteralInteger", "value": _mult(r.mult_origen_min)})
        ET.SubElement(end1, "upperValue", {f"{{{XMI_NS}}}type": "uml:LiteralUnlimitedNatural", "value": _mult(r.mult_origen_max)})

        end2 = ET.SubElement(assoc_el, "ownedEnd", {
            f"{{{XMI_NS}}}type": "uml:Property",
            f"{{{XMI_NS}}}id": f"E2_{r.id}",
            "type": class_ids[r.destino_id],
            "aggregation": _AGGREGATION_BY_TYPE.get(r.tipo, "none"),
        })
        ET.SubElement(end2, "lowerValue", {f"{{{XMI_NS}}}type": "uml:LiteralInteger", "value": _mult(r.mult_destino_min)})
        ET.SubElement(end2, "upperValue", {f"{{{XMI_NS}}}type": "uml:LiteralUnlimitedNatural", "value": _mult(r.mult_destino_max)})

    # Extension propietaria de Enterprise Architect: calcada tag por tag de
    # prueba.xmi (exportado desde un EA real), incluyendo el casing exacto
    # en minuscula de elements/diagrams/diagram/element/model/properties,
    # que en un intento anterior se escribio mal en mayuscula y por eso EA
    # no resolvia el diagrama pese a que el xmi:id coincidia.
    ext_el = ET.SubElement(xmi_root, f"{{{XMI_NS}}}Extension", {"extender": "Enterprise Architect", "extenderID": "6.5"})
    ext_elements_el = ET.SubElement(ext_el, "elements")
    for c in classes:
        shadow_el = ET.SubElement(ext_elements_el, "element", {
            f"{{{XMI_NS}}}idref": class_ids[c.id],
            f"{{{XMI_NS}}}type": "uml:Class",
            "name": c.nombre,
            "scope": "public",
        })
        ET.SubElement(shadow_el, "model", {"package": package_id, "ea_eleType": "element"})
        ET.SubElement(shadow_el, "properties", {
            "isSpecification": "false", "sType": "Class", "nType": "0",
            "scope": "public", "isRoot": "false", "isLeaf": "false",
            "isAbstract": "false", "isActive": "false",
        })

    diagrams_el = ET.SubElement(ext_el, "diagrams")
    diagram_el = ET.SubElement(diagrams_el, "diagram", {f"{{{XMI_NS}}}id": "DIAG_1"})
    # owner apunta al PAQUETE (no al Model), igual que en prueba.xmi linea
    # 535: <model package="EAPK_..." localID="4" owner="EAPK_..."/>
    ET.SubElement(diagram_el, "model", {"package": package_id, "localID": "1", "owner": package_id})
    ET.SubElement(diagram_el, "properties", {"name": diagram.title or "diagram", "type": "Logical"})
    diagram_elements_el = ET.SubElement(diagram_el, "elements")
    for seqno, c in enumerate(classes, start=1):
        left = c.x_grid * GRID_PX
        top = c.y_grid * GRID_PX
        right = left + c.w_grid * GRID_PX
        bottom = top + c.h_grid * GRID_PX
        ET.SubElement(diagram_elements_el, "element", {
            "geometry": f"Left={left};Top={top};Right={right};Bottom={bottom};",
            "subject": class_ids[c.id],
            "seqno": str(seqno),
        })

    ET.indent(xmi_root, space="  ")
    return b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(xmi_root, encoding="utf-8")




# =====================================================================
# Import: XMI (cualquier dialecto) -> ImportResult
# =====================================================================
def _xmi_id_any(el: ET.Element) -> str | None:
    """xmi.id (dialecto legacy XMI 1.1) o xmi:id (XMI 2.1), lo que este presente."""
    return el.get("xmi.id") or el.get(f"{{{XMI_NS}}}id")


def _xmi_idref_any(el: ET.Element) -> str | None:
    return el.get("xmi.idref") or el.get(f"{{{XMI_NS}}}idref")


def _detect_dialect(root: ET.Element) -> str:
    """"xmi1.1-legacy" tiene xmi.version como atributo plano y XMI.content
    como hijo (dialecto viejo, solo exigido por la funcion "Merge" de EA);
    "xmi2.1" usa el namespace omg.org/spec/XMI/2.1 con prefijo de dos
    puntos y es el que EA realmente exporta / espera en "Import Package
    from XML" (ver docstring del modulo)."""
    if root.get("xmi.version") or _local(root.tag) == "XMI" and any(
        _local(c.tag) == "XMI.content" for c in root
    ):
        return "xmi1.1-legacy"
    return "xmi2.1"


def _parse_xmi1_legacy(root: ET.Element) -> ImportResult:
    """Lector del dialecto XMI 1.1 mas viejo. NO ES el que un Enterprise
    Architect real usa para exportar ni para "Import Package from XML" --
    solo se lo tuvo en cuenta porque la funcion "Merge" de EA lo exige
    explicitamente (ver docstring del modulo). NO ESTA VERIFICADO contra
    ningun archivo real: es best-effort, por si algun archivo asi aparece."""
    result = ImportResult(dialect="xmi1.1-legacy")

    by_id: dict[str, ET.Element] = {}
    for el in root.iter():
        xid = _xmi_id_any(el)
        if xid:
            by_id[xid] = el

    # Posiciones del diagrama, si el archivo trae la extension de EA: se
    # usan para no apilar todo en (0,0) al importar. El tag real (verificado
    # contra prueba.xmi, exportado desde EA) es <element geometry="..."
    # subject="..."/> en minuscula, dentro de <diagram><elements>.
    geometry_by_subject: dict[str, tuple[int, int, int, int]] = {}
    for el in root.iter():
        if _local(el.tag) != "element" or "geometry" not in el.attrib:
            continue
        subject = el.get("subject")
        geometry = el.get("geometry") or ""
        if not subject or not geometry:
            continue
        vals = dict(
            part.split("=", 1) for part in geometry.split(";") if "=" in part
        )
        try:
            geometry_by_subject[subject] = (
                int(vals.get("Left", 0)), int(vals.get("Top", 0)),
                int(vals.get("Right", 0)), int(vals.get("Bottom", 0)),
            )
        except ValueError:
            pass

    # Tags de clase-de-asociacion sintetica: EA representa esto como un tag
    # "associationclass" en la Association <-> un tag reverso en la Class.
    # Buscamos nuestro propio tag sintetico (que este mismo exportador
    # escribe) para saber que clases descartar si vienen sin contenido.
    synthetic_class_ids: set[str] = set()
    for el in root.iter():
        if _local(el.tag) == "TaggedValue" and el.get("tag") == _SYNTHETIC_TAG:
            owner = el.get("modelElement")
            if owner:
                synthetic_class_ids.add(owner)

    classes_by_id: dict[str, ImportedClass] = {}
    name_by_id: dict[str, str] = {}

    for el in root.iter():
        if _local(el.tag) != "Class":
            continue
        xid = _xmi_id_any(el)
        name = el.get("name")
        if not xid or not name:
            continue

        geom = geometry_by_subject.get(xid)
        ic = ImportedClass(
            xmi_id=xid, name=name,
            x=geom[0] if geom else None, y=geom[1] if geom else None,
            w=(geom[2] - geom[0]) if geom else None, h=(geom[3] - geom[1]) if geom else None,
            is_synthetic_association=xid in synthetic_class_ids,
        )

        for feature_container in el:
            if _local(feature_container.tag) != "Classifier.feature":
                continue
            for attr_el in feature_container:
                if _local(attr_el.tag) != "Attribute":
                    continue
                attr_name = attr_el.get("name")
                if not attr_name:
                    continue
                type_name = None
                for type_container in attr_el:
                    if _local(type_container.tag) == "StructuralFeature.type":
                        for type_ref in type_container:
                            type_name = type_ref.get("name") or (
                                by_id[type_ref.get("xmi.idref")].get("name")
                                if type_ref.get("xmi.idref") in by_id else None
                            )
                ic.attributes.append(ImportedAttribute(
                    name=attr_name,
                    type=_normalize_type_name(type_name),
                    required=attr_el.get("changeability") == "frozen",
                ))

        classes_by_id[xid] = ic
        name_by_id[xid] = name

    # Herencia (Generalization, dentro de GeneralizableElement.generalization)
    for el in root.iter():
        if _local(el.tag) != "Generalization":
            continue
        child_id = el.get("child")
        parent_id = el.get("parent")
        child_name = name_by_id.get(child_id)
        parent_name = name_by_id.get(parent_id)
        if child_name and parent_name:
            result.relations.append(ImportedRelation(
                from_name=child_name, to_name=parent_name, type="INHERITANCE",
                src_mult_min=1, src_mult_max=1, dst_mult_min=1, dst_mult_max=1,
            ))
        elif child_id:
            result.warnings.append(f"Herencia de clase id={child_id} con padre no resoluble, se omitio.")

    # Dependencias
    for el in root.iter():
        if _local(el.tag) != "Dependency":
            continue
        client_id = supplier_id = None
        for child in el:
            if _local(child.tag) == "Dependency.client":
                for ref in child:
                    client_id = _xmi_idref_any(ref)
            elif _local(child.tag) == "Dependency.supplier":
                for ref in child:
                    supplier_id = _xmi_idref_any(ref)
        client_name = name_by_id.get(client_id)
        supplier_name = name_by_id.get(supplier_id)
        if client_name and supplier_name:
            result.relations.append(ImportedRelation(
                from_name=client_name, to_name=supplier_name, type="DEPENDENCY",
                label=el.get("name"),
                src_mult_min=1, src_mult_max=1, dst_mult_min=1, dst_mult_max=1,
            ))
        else:
            result.warnings.append(f"Dependencia '{el.get('name') or _xmi_id_any(el)}' con extremos no resolubles, se omitio.")

    # Asociaciones (incluye agregacion/composicion via aggregation en cada end)
    for el in root.iter():
        if _local(el.tag) != "Association":
            continue

        ends: list[ET.Element] = []
        for child in el:
            if _local(child.tag) == "Association.connection":
                ends = [c for c in child if _local(c.tag) == "AssociationEnd"]

        if len(ends) != 2:
            result.warnings.append(f"Asociacion '{el.get('name') or _xmi_id_any(el)}' con extremos no resolubles, se omitio.")
            continue

        def _end_class_id(end: ET.Element) -> str | None:
            for child in end:
                if _local(child.tag) == "AssociationEnd.participant":
                    for ref in child:
                        return _xmi_idref_any(ref)
            return None

        def _end_mult(end: ET.Element) -> tuple[int, int | None]:
            raw = end.get("multiplicity", "1")
            if ".." in raw:
                lo_s, hi_s = raw.split("..", 1)
            else:
                lo_s = hi_s = raw
            lo = int(lo_s) if lo_s.isdigit() else 1
            hi = None if hi_s in ("*", "-1") else (int(hi_s) if hi_s.isdigit() else 1)
            return lo, hi

        src_id = _end_class_id(ends[0])
        dst_id = _end_class_id(ends[1])
        src_name = name_by_id.get(src_id)
        dst_name = name_by_id.get(dst_id)
        if not src_name or not dst_name:
            result.warnings.append(f"Asociacion '{el.get('name') or _xmi_id_any(el)}' referencia una clase que no se pudo resolver, se omitio.")
            continue

        agg = ends[1].get("aggregation", "none")
        rel_type = _TYPE_BY_AGGREGATION.get(agg, RelType.ASSOCIATION).value
        src_min, src_max = _end_mult(ends[0])
        dst_min, dst_max = _end_mult(ends[1])

        result.relations.append(ImportedRelation(
            from_name=src_name, to_name=dst_name, type=rel_type,
            label=el.get("name"),
            src_mult_min=src_min, src_mult_max=src_max,
            dst_mult_min=dst_min, dst_mult_max=dst_max,
        ))

    result.classes = [
        c for c in classes_by_id.values()
        if not (c.is_synthetic_association and not c.attributes)
    ]
    if not result.classes:
        result.warnings.append("No se encontro ninguna UML:Class en el archivo (dialecto XMI 1.1).")
    return result


def _normalize_type_name(raw: str | None) -> str:
    if not raw:
        return "string"
    key = raw.strip().lower()
    return _FROM_UML_PRIMITIVE.get(key) or _FROM_LOCAL_DATATYPE.get(key) or "string"


# --- Lector XMI 2.1: PRIMARIO y VERIFICADO -- escrito leyendo tag por tag
# prueba.xmi (un archivo real exportado desde un Enterprise Architect
# real con "Publish > Export Package to XMI"), y corrido contra ese mismo
# archivo. Si algo falla al importar un XMI real de EA, revisar primero
# que el archivo realmente sea XMI 2.1 (namespace xmi:/uml:) y no el
# dialecto legacy que exige "Merge" -- ver _detect_dialect. ---
def _parse_xmi21(root: ET.Element) -> ImportResult:
    result = ImportResult(dialect="xmi2.1")

    def _xmi_type(el: ET.Element) -> str | None:
        for key, val in el.attrib.items():
            if _local(key) == "type" and key.startswith("{" + XMI_NS):
                return val
        return None

    by_id: dict[str, ET.Element] = {}
    for el in root.iter():
        xid = _xmi_id_any(el)
        if xid:
            by_id[xid] = el

    # Posiciones del diagrama (extension de EA): <element geometry="..."
    # subject="..."/> dentro de xmi:Extension/diagrams/diagram/elements. El
    # "subject" es el xmi:id de la clase tal cual, sin prefijo de
    # namespace (verificado contra prueba.xmi). Sin esto, reimportar un
    # XMI exportado por este mismo sistema perdia el layout que el usuario
    # armo, tanto aca como en EA.
    geometry_by_subject: dict[str, tuple[int, int, int, int]] = {}
    for el in root.iter():
        if _local(el.tag) != "element" or "geometry" not in el.attrib:
            continue
        subject = el.get("subject")
        geometry = el.get("geometry") or ""
        if not subject:
            continue
        vals = dict(part.split("=", 1) for part in geometry.split(";") if "=" in part)
        try:
            geometry_by_subject[subject] = (
                int(vals.get("Left", 0)), int(vals.get("Top", 0)),
                int(vals.get("Right", 0)), int(vals.get("Bottom", 0)),
            )
        except ValueError:
            pass

    classes_by_id: dict[str, ImportedClass] = {}
    name_by_id: dict[str, str] = {}

    for el in root.iter():
        if _xmi_type(el) != "uml:Class":
            continue
        xid = _xmi_id_any(el)
        name = el.get("name")
        if not xid or not name:
            continue
        geom = geometry_by_subject.get(xid)
        ic = ImportedClass(
            xmi_id=xid, name=name,
            x=geom[0] if geom else None, y=geom[1] if geom else None,
            w=(geom[2] - geom[0]) if geom else None, h=(geom[3] - geom[1]) if geom else None,
        )
        for attr_el in el:
            if _local(attr_el.tag) != "ownedAttribute":
                continue
            if _xmi_type(attr_el) not in (None, "uml:Property"):
                continue
            attr_name = attr_el.get("name")
            if not attr_name:
                continue
            required = attr_el.get("isNullable") == "false" or attr_el.get("required") == "true"
            ic.attributes.append(ImportedAttribute(
                name=attr_name,
                type=_resolve_type_name_xmi2x(attr_el, by_id),
                required=required,
            ))
        classes_by_id[xid] = ic
        name_by_id[xid] = name

    for el in root.iter():
        if _xmi_type(el) != "uml:Class":
            continue
        child_id = _xmi_id_any(el)
        child_name = name_by_id.get(child_id)
        if not child_name:
            continue
        for gen_el in el:
            if _local(gen_el.tag) != "generalization":
                continue
            parent_id = gen_el.get("general")
            parent_name = name_by_id.get(parent_id) if parent_id else None
            if not parent_name and parent_id in by_id:
                parent_name = by_id[parent_id].get("name")
            if parent_name:
                result.relations.append(ImportedRelation(
                    from_name=child_name, to_name=parent_name, type="INHERITANCE",
                    src_mult_min=1, src_mult_max=1, dst_mult_min=1, dst_mult_max=1,
                ))
            else:
                result.warnings.append(f"Herencia de '{child_name}' con padre no resoluble, se omitio.")

    for el in root.iter():
        if _xmi_type(el) != "uml:Dependency":
            continue
        client = el.get("client")
        supplier = el.get("supplier")
        client_name = name_by_id.get(client) or (by_id.get(client).get("name") if client in by_id else None)
        supplier_name = name_by_id.get(supplier) or (by_id.get(supplier).get("name") if supplier in by_id else None)
        if client_name and supplier_name:
            result.relations.append(ImportedRelation(
                from_name=client_name, to_name=supplier_name, type="DEPENDENCY",
                label=el.get("name"),
                src_mult_min=1, src_mult_max=1, dst_mult_min=1, dst_mult_max=1,
            ))

    for el in root.iter():
        if _xmi_type(el) != "uml:Association":
            continue

        ends = [c for c in el if _local(c.tag) == "ownedEnd"]
        if len(ends) < 2:
            end_ids = [c.get(f"{{{XMI_NS}}}idref") for c in el if _local(c.tag) == "memberEnd"]
            ends = [by_id[i] for i in end_ids if i in by_id]

        if len(ends) != 2:
            result.warnings.append(f"Asociacion '{el.get('name') or _xmi_id_any(el)}' con extremos no resolubles, se omitio.")
            continue

        def _end_class_name(end: ET.Element) -> str | None:
            type_id = end.get("type")
            if type_id and type_id in name_by_id:
                return name_by_id[type_id]
            for child in end:
                if _local(child.tag) == "type":
                    idref = child.get(f"{{{XMI_NS}}}idref") or child.get("href", "").rsplit("#", 1)[-1]
                    return name_by_id.get(idref)
            return None

        def _end_mult(end: ET.Element) -> tuple[int, int | None]:
            lo, hi = 1, 1
            for child in end:
                tag = _local(child.tag)
                if tag == "lowerValue":
                    try:
                        lo = int(child.get("value", "1"))
                    except ValueError:
                        lo = 1
                elif tag == "upperValue":
                    v = child.get("value", "1")
                    hi = None if v in ("*", "-1") else int(v) if v.isdigit() else 1
            return lo, hi

        src_name = _end_class_name(ends[0])
        dst_name = _end_class_name(ends[1])
        if not src_name or not dst_name:
            result.warnings.append(f"Asociacion '{el.get('name') or _xmi_id_any(el)}' referencia una clase que no se pudo resolver, se omitio.")
            continue

        agg = ends[1].get("aggregation", "none")
        rel_type = _TYPE_BY_AGGREGATION.get(agg, RelType.ASSOCIATION).value
        src_min, src_max = _end_mult(ends[0])
        dst_min, dst_max = _end_mult(ends[1])

        result.relations.append(ImportedRelation(
            from_name=src_name, to_name=dst_name, type=rel_type,
            label=el.get("name"),
            src_mult_min=src_min, src_mult_max=src_max,
            dst_mult_min=dst_min, dst_mult_max=dst_max,
        ))

    result.classes = list(classes_by_id.values())
    if not result.classes:
        result.warnings.append("No se encontro ninguna uml:Class en el archivo (dialecto XMI 2.1).")
    return result


def _resolve_type_name_xmi2x(attr_el: ET.Element, by_id: dict[str, ET.Element]) -> str:
    type_el = None
    for child in attr_el:
        if _local(child.tag) == "type":
            type_el = child
            break

    raw = None
    if type_el is not None:
        href = type_el.get("href")
        if href:
            raw = href.rsplit("#", 1)[-1]
        else:
            idref = None
            for key, val in type_el.attrib.items():
                if _local(key) == "idref":
                    idref = val
            if idref and idref in by_id:
                raw = by_id[idref].get("name")
            elif idref:
                raw = idref
    if not raw:
        raw = attr_el.get("type")

    return _normalize_type_name(raw)


def parse_xmi(xml_bytes: bytes) -> ImportResult:
    """Punto de entrada unico de import: detecta si el archivo es XMI 2.1
    (el que EA realmente exporta/espera, verificado) o el dialecto legacy
    XMI 1.1 (solo exigido por la funcion "Merge" de EA, sin verificar
    contra un archivo real), y delega al lector correspondiente. Lanza
    InvalidXmiError si el XML esta mal formado/vacio/demasiado grande, o
    UnsupportedXmiError si esta bien formado pero no hay ningun modelo UML
    reconocible en ninguno de los dos dialectos."""
    if not xml_bytes:
        raise InvalidXmiError("El archivo esta vacio.")
    if len(xml_bytes) > MAX_XMI_BYTES:
        raise InvalidXmiError(f"El archivo supera el tamano maximo permitido ({MAX_XMI_BYTES // 1024 // 1024} MB).")

    try:
        root = safe_fromstring(xml_bytes)
    except DefusedXmlException as e:
        raise InvalidXmiError(f"El archivo XML contiene una construccion no permitida: {e}") from e
    except ET.ParseError as e:
        raise InvalidXmiError(f"El archivo no es XML valido: {e}") from e

    dialect = _detect_dialect(root)
    result = _parse_xmi1_legacy(root) if dialect == "xmi1.1-legacy" else _parse_xmi21(root)

    if not result.classes:
        raise UnsupportedXmiError(
            "No se encontro ningun modelo de clases UML reconocible en el archivo. " + " ".join(result.warnings)
        )

    return result
