# exporters/generators/uml_to_json.py
"""
Convierte un UML (ya en formato dict) a un archivo JSON estándar.
"""

import json
from exporters.generators.validator import validate_diagram, UMLValidationError


def export_diagram_to_json(diagram_dict: dict, output_path: str) -> str:
    """
    Valida y exporta un diagrama UML a JSON.
    - diagram_dict: diccionario con clases, atributos, métodos, relaciones
    - output_path: ruta donde guardar el JSON
    """
    # 1. Validar
    validate_diagram(diagram_dict)

    # 2. Guardar en archivo JSON
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"diagram": diagram_dict}, f, indent=4, ensure_ascii=False)

    return output_path
