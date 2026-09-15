# exporters/generators/type_mapping.py
"""
Mapeo unico UML -> tipo Java, usado por todos los generadores (entidades,
DTOs, etc).

Antes cada generador tenia su propia copia de este diccionario, y las
copias solo reconocian claves en minuscula sin alias ("int", "double",
"string"...). El asistente de IA crea atributos con tipos al estilo Java
("Integer", "Double", "Boolean", con mayuscula), y el editor manual usa
nombres UML en minuscula ("int", "decimal", "text"...). Como el lookup no
normalizaba may/min ni conocia los alias, cualquier tipo que no calzara
letra por letra cafa en el default "String" sin avisar -- un atributo
"stock" de tipo Integer terminaba generado como `private String stock;`.
"""

_MAPPING = {
    # UML clasico (lo que ofrece el selector del Inspector)
    "int": "Integer",
    "long": "Long",
    "string": "String",
    "text": "String",
    "float": "Float",
    "double": "Double",
    "decimal": "java.math.BigDecimal",
    "boolean": "Boolean",
    "date": "LocalDate",
    "datetime": "LocalDateTime",
    "uuid": "String",
    "email": "String",

    # Alias que puede generar el asistente de IA (tipos "estilo Java")
    "integer": "Integer",
    "bool": "Boolean",
    "localdate": "LocalDate",
    "localdatetime": "LocalDateTime",
    "timestamp": "LocalDateTime",
    "bigdecimal": "java.math.BigDecimal",
}


def map_type(attr_type: str) -> str:
    """Traduce un tipo UML/atributo (en cualquier capitalizacion conocida)
    al tipo Java correspondiente. Si no se reconoce, cae a String."""
    if not attr_type:
        return "String"
    return _MAPPING.get(attr_type.strip().lower(), "String")
