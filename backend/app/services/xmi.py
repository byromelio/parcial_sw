# app/services/xmi.py
"""
Interoperabilidad XMI con Enterprise Architect (requisito de la catedra:
"la herramienta se deberia poder integrar con el Architect sin mayor
problema, ya sea importando o exportando... generalmente se utiliza un
mecanismo basado en XMI, que es una especializacion de XML").

Exportamos y parseamos un subconjunto de UML 2.x XMI 2.1 (el mismo dialecto
que entiende EA de forma nativa): paquete -> uml:Class con ownedAttribute,
generalization para herencia, y uml:Association (con ownedEnd, agregacion y
multiplicidad) para el resto de las relaciones.

Import defensivo a proposito: un archivo XMI exportado por otra herramienta
(o por versiones distintas de EA) varia bastante en como referencia tipos y
extremos de asociacion. El objetivo del profesor es "no partir de cero", asi
que preferimos importar clases/atributos/relaciones de forma best-effort en
vez de rechazar el archivo entero por un detalle que no podemos resolver.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from xml.etree import ElementTree as ET

from app.models.uml import RelType

XMI_NS = "http://schema.omg.org/spec/XMI/2.1"
UML_NS = "http://schema.omg.org/spec/UML/2.1"
NS = {"xmi": XMI_NS, "uml": UML_NS}

ET.register_namespace("xmi", XMI_NS)
ET.register_namespace("uml", UML_NS)

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
_FROM_UML_PRIMITIVE = {"integer": "int", "real": "float", "boolean": "boolean", "string": "string"}
_FROM_LOCAL_DATATYPE = {"date": "date", "datetime": "datetime"}

_AGGREGATION_BY_TYPE = {
    RelType.COMPOSITION: "composite",
    RelType.AGGREGATION: "shared",
    RelType.ASSOCIATION: "none",
}
_TYPE_BY_AGGREGATION = {v: k for k, v in _AGGREGATION_BY_TYPE.items()}


def _mult(value: int | None) -> str:
    return "*" if value is None else str(value)


# =====================================================================
# Export: diagrama -> XMI
# =====================================================================
def build_xmi(diagram) -> bytes:
    root = ET.Element(f"{{{XMI_NS}}}XMI", {f"{{{XMI_NS}}}version": "2.1"})
    model = ET.SubElement(root, f"{{{UML_NS}}}Model", {
        f"{{{XMI_NS}}}type": "uml:Model",
        f"{{{XMI_NS}}}id": "model_1",
        "name": "EA_Model",
    })
    # EA exporta/espera un paquete explicito debajo del Model raiz (nunca
    # deja las clases colgando directo de uml:Model): sin este nivel, el
    # import genera un diagrama pero EA no consigue resolver correctamente
    # el "owner" del paquete al reconstruir el arbol del proyecto.
    package_id = "PKG_root"
    package = ET.SubElement(model, "packagedElement", {
        f"{{{XMI_NS}}}type": "uml:Package",
        f"{{{XMI_NS}}}id": package_id,
        "name": diagram.title or "diagram",
    })

    class_ids = {c.id: f"C_{c.id}" for c in diagram.classes}
    used_datatypes: set[str] = set()

    for c in diagram.classes:
        el = ET.SubElement(package, "packagedElement", {
            f"{{{XMI_NS}}}type": "uml:Class",
            f"{{{XMI_NS}}}id": class_ids[c.id],
            "name": c.nombre,
        })
        for a in c.atributos:
            attr_el = ET.SubElement(el, "ownedAttribute", {
                f"{{{XMI_NS}}}type": "uml:Property",
                f"{{{XMI_NS}}}id": f"A_{a.id}",
                "name": a.nombre,
                "visibility": "private",
            })
            if a.requerido:
                attr_el.set("isNullable", "false")

            tipo = (a.tipo or "string").strip().lower()
            if tipo in _TO_UML_PRIMITIVE:
                ET.SubElement(attr_el, "type", {
                    f"{{{XMI_NS}}}type": "uml:PrimitiveType",
                    "href": _PRIMITIVE_HREF.format(name=_TO_UML_PRIMITIVE[tipo]),
                })
            elif tipo in _LOCAL_DATATYPES:
                used_datatypes.add(tipo)
                ET.SubElement(attr_el, "type", {
                    f"{{{XMI_NS}}}idref": f"DT_{tipo}",
                })
            else:
                # Tipo que no conocemos (ej. uno inventado a mano): lo
                # exportamos igual, como String, para no perder el atributo.
                ET.SubElement(attr_el, "type", {
                    f"{{{XMI_NS}}}type": "uml:PrimitiveType",
                    "href": _PRIMITIVE_HREF.format(name="String"),
                })

        # Herencia: generalization vive DENTRO del elemento hijo (origen).
        for r in c.outgoing_relations:
            if r.tipo == RelType.INHERITANCE:
                ET.SubElement(el, "generalization", {
                    f"{{{XMI_NS}}}id": f"G_{r.id}",
                    "general": class_ids[r.destino_id],
                })

    # DataTypes locales, solo si algun atributo los usa.
    for tipo in sorted(used_datatypes):
        ET.SubElement(package, "packagedElement", {
            f"{{{XMI_NS}}}type": "uml:DataType",
            f"{{{XMI_NS}}}id": f"DT_{tipo}",
            "name": _LOCAL_DATATYPES[tipo],
        })

    # Resto de las relaciones (asociacion / agregacion / composicion / dependencia).
    for r in diagram.relations:
        if r.tipo == RelType.INHERITANCE:
            continue  # ya se exporto como generalization

        if r.tipo == RelType.DEPENDENCY:
            ET.SubElement(package, "packagedElement", {
                f"{{{XMI_NS}}}type": "uml:Dependency",
                f"{{{XMI_NS}}}id": f"D_{r.id}",
                "client": class_ids[r.origen_id],
                "supplier": class_ids[r.destino_id],
                **({"name": r.etiqueta} if r.etiqueta else {}),
            })
            continue

        assoc = ET.SubElement(package, "packagedElement", {
            f"{{{XMI_NS}}}type": "uml:Association",
            f"{{{XMI_NS}}}id": f"AS_{r.id}",
            **({"name": r.etiqueta} if r.etiqueta else {}),
        })
        ET.SubElement(assoc, "memberEnd", {f"{{{XMI_NS}}}idref": f"E1_{r.id}"})
        ET.SubElement(assoc, "memberEnd", {f"{{{XMI_NS}}}idref": f"E2_{r.id}"})

        end1 = ET.SubElement(assoc, "ownedEnd", {
            f"{{{XMI_NS}}}type": "uml:Property",
            f"{{{XMI_NS}}}id": f"E1_{r.id}",
            "type": class_ids[r.origen_id],
            "aggregation": "none",
        })
        ET.SubElement(end1, "lowerValue", {f"{{{XMI_NS}}}type": "uml:LiteralInteger", "value": _mult(r.mult_origen_min)})
        ET.SubElement(end1, "upperValue", {f"{{{XMI_NS}}}type": "uml:LiteralUnlimitedNatural", "value": _mult(r.mult_origen_max)})

        end2 = ET.SubElement(assoc, "ownedEnd", {
            f"{{{XMI_NS}}}type": "uml:Property",
            f"{{{XMI_NS}}}id": f"E2_{r.id}",
            "type": class_ids[r.destino_id],
            "aggregation": _AGGREGATION_BY_TYPE.get(r.tipo, "none"),
        })
        ET.SubElement(end2, "lowerValue", {f"{{{XMI_NS}}}type": "uml:LiteralInteger", "value": _mult(r.mult_destino_min)})
        ET.SubElement(end2, "upperValue", {f"{{{XMI_NS}}}type": "uml:LiteralUnlimitedNatural", "value": _mult(r.mult_destino_max)})

    # Extension propietaria de Enterprise Architect, replicando la
    # estructura real que EA genera (verificado exportando un diagrama de
    # prueba desde el propio EA e inspeccionando el XMI resultante). No
    # alcanza con declarar el diagrama y apuntar "subject" al xmi:id de la
    # clase en uml:Model: EA tambien exige una "sombra" de cada elemento
    # dentro de xmi:Extension/elements (con sus propios bloques <model>,
    # <properties>, etc.) antes de que el bloque <diagrams> pueda resolver
    # ese mismo id. Sin esa sombra, el intento anterior (solo <diagrams>,
    # sin <elements>) dejaba el canvas del diagrama vacio pese a que el
    # xmi:id coincidia exactamente.
    GRID_PX = 20
    ext = ET.SubElement(root, f"{{{XMI_NS}}}Extension", {"extender": "Enterprise Architect", "extenderID": "6.5"})
    elements_el = ET.SubElement(ext, "elements")
    for c in diagram.classes:
        el_shadow = ET.SubElement(elements_el, "element", {
            f"{{{XMI_NS}}}idref": class_ids[c.id],
            f"{{{XMI_NS}}}type": "uml:Class",
            "name": c.nombre,
            "scope": "public",
        })
        ET.SubElement(el_shadow, "model", {"package": package_id, "ea_eleType": "element"})
        ET.SubElement(el_shadow, "properties", {
            "isSpecification": "false", "sType": "Class", "nType": "0",
            "scope": "public", "isRoot": "false", "isLeaf": "false",
            "isAbstract": "false", "isActive": "false",
        })

    diagrams_el = ET.SubElement(ext, "diagrams")
    diagram_el = ET.SubElement(diagrams_el, "diagram", {f"{{{XMI_NS}}}id": "DIAG_1"})
    ET.SubElement(diagram_el, "model", {"package": package_id, "localID": "1", "owner": package_id})
    ET.SubElement(diagram_el, "properties", {"name": diagram.title or "diagram", "type": "Logical"})
    ET.SubElement(diagram_el, "project", {"author": "System", "version": "1.0"})
    ET.SubElement(diagram_el, "style1", {"value": "ShowPrivate=1;ShowProtected=1;ShowPublic=1;HideRelationships=0;Locked=0;Border=1;HighlightForeign=1;PackageContents=1;SequenceNotes=0;ScalePrintImage=0;PPgs.cx=1;PPgs.cy=1;DocSize.cx=827;DocSize.cy=1169;ShowDetails=0;Orientation=P;Zoom=100;ShowTags=0;OpParams=1;VisibleAttributeDetail=0;ShowOpRetType=1;ShowIcons=1;CollabNums=0;HideProps=0;ShowReqs=0;ShowCons=0;PaperSize=9;HideParents=0;UseAlias=0;HideAtts=0;HideOps=0;HideStereo=0;HideElemStereo=0;ShowTests=0;ShowMaint=0;ConnectorNotation=UML 2.1;ExplicitNavigability=0;ShowShape=1;AdvancedElementProps=1;AdvancedFeatureProps=1;AdvancedConnectorProps=1;m_bElementClassifier=1;ShowNotes=0;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;"})
    ET.SubElement(diagram_el, "style2", {"value": "SaveTag=0E500A58;"})
    ET.SubElement(diagram_el, "swimlanes", {"value": "locked=false;orientation=0;width=0;inbar=false;palette=0;backcolor=0;clearcolors=0;showwtext=0;wordwrap=0;coridor=0;"})
    ET.SubElement(diagram_el, "matrixitems", {"value": "locked=false;matrixactive=false;swimlanesactive=true;kanbanactive=false;width=1;clrLine=0;"})
    ET.SubElement(diagram_el, "extendedProperties")

    diagram_elements = ET.SubElement(diagram_el, "elements")
    for seqno, c in enumerate(diagram.classes, start=1):
        # EA coord limits (usually positive for Left/Right, negative for Top/Bottom, or just normal Cartesian)
        # Assuming grid based
        left = c.x_grid * GRID_PX
        top = c.y_grid * GRID_PX
        right = left + c.w_grid * GRID_PX
        bottom = top + c.h_grid * GRID_PX
        
        ET.SubElement(diagram_elements, "element", {
            "geometry": f"Left={left};Top={top};Right={right};Bottom={bottom};",
            "subject": class_ids[c.id],
            "seqno": str(seqno),
            "style": f"DUID={class_ids[c.id][:8]};"
        })

    ET.indent(root, space="  ")
    return b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="utf-8")


# =====================================================================
# Import: XMI -> estructura neutra (el router decide como aplicarla a la BD)
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


def _local(tag: str) -> str:
    """'{ns}Class' -> 'Class' (para no depender de que el prefijo sea exactamente uml:)."""
    return tag.rsplit("}", 1)[-1]


def _xmi_type(el: ET.Element) -> str | None:
    """Valor crudo de xmi:type (ej. 'uml:Class'), sin tocar el prefijo: los
    llamadores comparan contra 'uml:Class', 'uml:Association', etc."""
    for key, val in el.attrib.items():
        if _local(key) == "type" and key.startswith("{" + XMI_NS):
            return val
    return None


def _xmi_id(el: ET.Element) -> str | None:
    for key, val in el.attrib.items():
        if _local(key) == "id" and key.startswith("{" + XMI_NS):
            return val
    return None


def _resolve_type_name(attr_el: ET.Element, by_id: dict[str, ET.Element]) -> str:
    """Intenta sacarle un tipo legible a un ownedAttribute, tolerando los
    varios estilos con los que distintas versiones/exportadores de EA
    referencian el tipo (href a la libreria estandar, idref a un DataType
    definido en el mismo archivo, o un atributo 'type' plano)."""
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

    if not raw:
        return "string"

    key = raw.strip().lower()
    return _FROM_UML_PRIMITIVE.get(key) or _FROM_LOCAL_DATATYPE.get(key) or "string"


def parse_xmi(xml_bytes: bytes) -> ImportResult:
    result = ImportResult()
    try:
        tree = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        result.warnings.append(f"El archivo no es XML valido: {e}")
        return result

    by_id: dict[str, ET.Element] = {}
    for el in tree.iter():
        xid = _xmi_id(el)
        if xid:
            by_id[xid] = el

    classes_by_id: dict[str, ImportedClass] = {}
    name_by_id: dict[str, str] = {}

    # --- Clases + atributos ---
    for el in tree.iter():
        if _xmi_type(el) != "uml:Class":
            continue
        xid = _xmi_id(el)
        name = el.get("name")
        if not xid or not name:
            continue
        ic = ImportedClass(xmi_id=xid, name=name)
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
                type=_resolve_type_name(attr_el, by_id),
                required=required,
            ))
        classes_by_id[xid] = ic
        name_by_id[xid] = name

    if not classes_by_id:
        result.warnings.append("No se encontro ninguna uml:Class en el archivo.")

    # --- Herencia (generalization, vive dentro de la clase hija) ---
    for el in tree.iter():
        if _xmi_type(el) != "uml:Class":
            continue
        child_id = _xmi_id(el)
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

    # --- Dependencias ---
    for el in tree.iter():
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

    # --- Asociaciones (incluye agregacion/composicion via aggregation="shared"/"composite") ---
    for el in tree.iter():
        if _xmi_type(el) != "uml:Association":
            continue

        ends = [c for c in el if _local(c.tag) == "ownedEnd"]
        if len(ends) < 2:
            # Estilo alternativo: memberEnd apunta a Property definidas afuera
            # (a veces dentro de cada clase en vez de en la asociacion).
            end_ids = [c.get(f"{{{XMI_NS}}}idref") for c in el if _local(c.tag) == "memberEnd"]
            ends = [by_id[i] for i in end_ids if i in by_id]

        if len(ends) != 2:
            result.warnings.append(
                f"Asociacion '{el.get('name') or _xmi_id(el)}' con extremos no resolubles, se omitio."
            )
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
            result.warnings.append(
                f"Asociacion '{el.get('name') or _xmi_id(el)}' referencia una clase que no se pudo resolver, se omitio."
            )
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
    return result
