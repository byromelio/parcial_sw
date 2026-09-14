import os, json
from jinja2 import Environment, FileSystemLoader

def generate_dtos(json_path, output_dir, templates_dir="../templates"):
    os.makedirs(output_dir, exist_ok=True)

    env = Environment(loader=FileSystemLoader(templates_dir))
    template = env.get_template("dto.java.j2")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    diagram = data["diagram"]

    for c in diagram["classes"]:
        class_name = c["name"]
        attributes = c.get("attributes", [])

        # Mapear tipos UML a Java
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

        for attr in attributes:
            if attr["name"].lower() == "id":
                attr["type"] = "Long"  # 👈 Siempre Long para id
            else:
                attr["type"] = mapping.get(attr["type"].lower(), "String")

        file_name = f"{class_name}Dto.java"
        file_path = os.path.join(output_dir, file_name)

        code = template.render(class_name=class_name, attributes=attributes)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)

        print(f"✅ Generado DTO: {file_path}")
