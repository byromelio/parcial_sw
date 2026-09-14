# exporters/generators/validator.py
"""
validator.py
Valida que el diagrama UML tenga consistencia antes de exportarlo.
"""


class UMLValidationError(Exception):
    """Error lanzado cuando el UML no cumple las reglas mínimas."""
    pass


def validate_diagram(diagram: dict) -> None:
    """
    Valida un diagrama UML representado como diccionario.
    Espera las claves: 'id', 'title', 'classes', 'relations'.

    Reglas básicas:
    - Debe tener al menos 1 clase.
    - Cada clase debe tener un nombre único.
    - Cada atributo debe tener nombre y tipo.
    - Las relaciones deben apuntar a clases existentes.
    """

    if "classes" not in diagram or not diagram["classes"]:
        raise UMLValidationError("El diagrama debe tener al menos una clase.")

    # Validar nombres únicos
    nombres = [c["name"] for c in diagram["classes"]]
    if len(nombres) != len(set(nombres)):
        raise UMLValidationError("Existen clases con nombres duplicados.")

    # Validar atributos
    for clase in diagram["classes"]:
        for attr in clase.get("attributes", []):
            if not attr.get("name") or not attr.get("type"):
                raise UMLValidationError(
                    f"Atributo inválido en clase {clase['name']} (faltan nombre o tipo)."
                )

    # Validar relaciones
    class_names = {c["name"] for c in diagram["classes"]}
    for rel in diagram.get("relations", []):
        if rel["from"] not in class_names:
            raise UMLValidationError(f"Relación inválida: clase origen '{rel['from']}' no existe.")
        if rel["to"] not in class_names:
            raise UMLValidationError(f"Relación inválida: clase destino '{rel['to']}' no existe.")

    # Si todo pasó:
    return None
