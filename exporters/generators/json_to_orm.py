# json_to_orm.py
"""
Convierte un diagrama UML exportado a JSON en entidades Java con JPA.
👉 En esta primera versión solo genera las clases con atributos (sin relaciones).
"""

import os, json
from jinja2 import Environment, FileSystemLoader

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
# 📂 Carpeta donde se guardarán las clases generadas
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "generated", "models")
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ========================
# Función de mapeo de tipos
# ========================
def map_type(attr_type: str) -> str:
    """
    Convierte un tipo genérico del UML a su equivalente en Java.
    Si no lo encuentra en el diccionario, devuelve String por defecto.
    """
    mapping = {
        "int": "Integer",
        "long": "Long",
        "string": "String",
        "float": "Float",
        "double": "Double",
        "boolean": "Boolean",
        "date": "LocalDate",
        "datetime": "LocalDateTime"
    }
    return mapping.get(attr_type.lower(), "String")


# ========================
# Generador de entidad Java
# ========================
def generate_entity(class_def: dict):
    """
    Recibe un diccionario que describe una clase UML
    y devuelve el código Java como string.
    """

    class_name = class_def["name"]
    attributes = class_def.get("attributes", [])

    # 🔹 Si no existe atributo "id", lo agregamos automáticamente
    has_id = any(attr["name"].lower() == "id" for attr in attributes)
    if not has_id:
        attributes.insert(0, {"name": "id", "type": "long", "required": True})
    # Mapear tipos
    for attr in attributes:
        
        if attr["name"].lower() == "id":
            attr["type"] = "Long"
        else:
            attr["type"] = map_type(attr["type"])

    # Render con Jinja2
   # Render con Jinja2
    template = env.get_template("model.java.j2")
    return template.render(package="com.test", class_name=class_name, attributes=attributes)
   # # ========================
    # # Cabecera de la clase
    # # ========================
    # lines = []
    # lines.append("import jakarta.persistence.*;")
    # lines.append("import java.time.*;")
    # lines.append("")
    # lines.append("@Entity")
    # lines.append(f"public class {class_name} " + "{")
    # lines.append("")

    # # ========================
    # # Definición de atributos
    # # ========================
    # for attr in attributes:
    #     attr_name = attr["name"]
    #     attr_type = map_type(attr["type"])

    #     if attr_name.lower() == "id":  # Primary Key
    #         lines.append("    @Id")
    #         lines.append("    @GeneratedValue(strategy = GenerationType.IDENTITY)")
    #     lines.append(f"    private {attr_type} {attr_name};")
    #     lines.append("")

    # # ========================
    # # Getters y Setters
    # # ========================
    # for attr in attributes:
    #     attr_name = attr["name"]
    #     attr_type = map_type(attr["type"])
    #     method_name = attr_name[0].upper() + attr_name[1:]

    #     # Getter
    #     lines.append(f"    public {attr_type} get{method_name}() " + "{")
    #     lines.append(f"        return {attr_name};")
    #     lines.append("    }")
    #     lines.append("")

    #     # Setter
    #     lines.append(f"    public void set{method_name}({attr_type} {attr_name}) " + "{")
    #     lines.append(f"        this.{attr_name} = {attr_name};")
    #     lines.append("    }")
    #     lines.append("")

    # # ========================
    # # Cierre de la clase
    # # ========================
    # lines.append("}")

    # return "\n".join(lines)


# ========================
# Función principal
# ========================
def generate_from_json(json_path: str):
    """
    Lee un archivo JSON exportado desde el UML
    y genera una clase .java por cada clase en el diagrama.
    """
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    diagram = data["diagram"]

    for c in diagram["classes"]:
        code = generate_entity(c)
        file_path = os.path.join(OUTPUT_DIR, f"{c['name']}.java")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        print(f"✅ Generada entidad: {file_path}")


# ========================
# Ejecución directa
# ========================
if __name__ == "__main__":
    generate_from_json("../json/diagram_367493a5-e490-4665-a73f-8626674b2ee2.json")
