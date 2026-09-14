
# postman_generator.py
import os, json, random
from datetime import datetime, timedelta
from exporters.generators.json_to_relations import build_relations, to_camel

# 🔹 Generar valores de ejemplo según tipo
def example_for(attr_type: str):
    t = attr_type.lower()

    if t in ("int", "integer", "long"):
        return random.randint(1, 100)
    if t in ("float", "double"):
        return round(random.uniform(1, 100), 2)
    if t == "boolean":
        return random.choice([True, False])
    if t == "date":
        return (datetime.today() + timedelta(days=random.randint(0, 30))).strftime("%Y-%m-%d")
    if t == "datetime":
        return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    # default string
    return "Texto de ejemplo"

# 🔹 Construir URL en formato Postman (raw, protocol, host, port, path)
def build_url(url_raw: str):
    protocol = "http"
    host = ["localhost"]
    port = "8090"
    path = url_raw.replace("http://localhost:8090/", "").split("/")
    return {
        "raw": url_raw,
        "protocol": protocol,
        "host": host,
        "port": port,
        "path": path
    }

def generate_postman(json_path, output_dir):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    diagram = data["diagram"]
    relations_map = build_relations(json_path)

    # 📂 Carpeta de archivos individuales
    test_bodies_dir = os.path.join(output_dir, "test_bodies")
    os.makedirs(test_bodies_dir, exist_ok=True)

    for c in diagram["classes"]:
        class_name = c["name"]
        url_base = f"http://localhost:8090/api/{class_name.lower()}s"
        attributes = c.get("attributes", [])

        # 🔹 Construir body inicial
        body = {}
        for attr in attributes:
            name = to_camel(attr["name"])
            if name.lower() == "id":
                continue
            body[name] = example_for(attr["type"])

        # 🔹 Relaciones
        if class_name in relations_map:
            for target, rel in relations_map[class_name].items():
                rel_type = rel["type"]
                if rel_type in ("ManyToOne", "OneToOne", "Dependency", "Aggregation", "Composition"):
                    body[to_camel(target)] = {"id": 1}
                elif rel_type in ("OneToMany", "ManyToMany"):
                    body[to_camel(target) + "s"] = [{"id": 1}, {"id": 2}]

        # 🔹 CRUD con build_url
        requests = [
            {
                "name": f"Create {class_name}",
                "request": {
                    "method": "POST",
                    "header": [{"key": "Content-Type", "value": "application/json"}],
                    "body": {"mode": "raw", "raw": json.dumps(body, indent=2, ensure_ascii=False)},
                    "url": build_url(url_base)
                }
            },
            {
                "name": f"Get All {class_name}",
                "request": {"method": "GET", "url": build_url(url_base)}
            },
            {
                "name": f"Get {class_name} by ID",
                "request": {"method": "GET", "url": build_url(f"{url_base}/1")}
            },
            {
                "name": f"Update {class_name}",
                "request": {
                    "method": "PUT",
                    "header": [{"key": "Content-Type", "value": "application/json"}],
                    "body": {"mode": "raw", "raw": json.dumps(body, indent=2, ensure_ascii=False)},
                    "url": build_url(f"{url_base}/1")
                }
            },
            {
                "name": f"Delete {class_name}",
                "request": {"method": "DELETE", "url": build_url(f"{url_base}/1")}
            }
        ]

        # 👉 Guardar CRUD por clase
        model_collection = {
            "info": {
                "name": f"{class_name} API",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "item": requests
        }

        file_path = os.path.join(test_bodies_dir, f"{class_name}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(model_collection, f, indent=2, ensure_ascii=False)

        print(f"📄 CRUD Postman generado: {file_path}")
