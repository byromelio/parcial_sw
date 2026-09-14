# # # project_builder.py
# import os
# from exporters.generators.json_to_full_orm import generate_from_json
# from exporters.generators.model_to_repository import generate_repositories
# from exporters.generators.repository_to_service import generate_services
# from exporters.generators.service_to_controller import generate_controllers  # ✅ nuevo import
# from exporters.generators.model_to_dto import generate_dtos
# from exporters.generators.postman_generator import generate_postman

# TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
# OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output", "generated_project_test")

# def render_template(template_path, context):
#     with open(template_path, "r", encoding="utf-8") as f:
#         content = f.read().lstrip()
#     for key, value in context.items():
#         content = content.replace("{{ " + key + " }}", value)
#     return content

# def build_project(json_path):
#     src_main = os.path.join(OUTPUT_DIR, "src", "main", "java", "com", "test")
#     src_models = os.path.join(src_main, "models")
#     src_repositories = os.path.join(src_main, "repositories")
#     src_services = os.path.join(src_main, "services")
#     src_controllers = os.path.join(src_main, "controllers")
#     src_dtos = os.path.join(src_main, "dtos")

#     resources = os.path.join(OUTPUT_DIR, "src", "main", "resources")

#     os.makedirs(src_main, exist_ok=True)
#     os.makedirs(src_models, exist_ok=True)
#     os.makedirs(src_repositories, exist_ok=True)
#     os.makedirs(src_services, exist_ok=True)
#     os.makedirs(src_controllers, exist_ok=True)
#     os.makedirs(src_dtos, exist_ok=True)
#     os.makedirs(resources, exist_ok=True)

#     # 1) Generar modelos directamente en src_models
#     generate_from_json(json_path, src_models)

#     # 2) Generar repositories
#     generate_repositories(json_path, src_repositories, TEMPLATES_DIR)

#     # 3) Generar services
#     generate_services(json_path, src_services, TEMPLATES_DIR)

#     # 4) Generar controllers CRUD
#     generate_controllers(json_path, src_controllers, TEMPLATES_DIR)

#     # 5) Generar DTOs
#     generate_dtos(json_path, src_dtos, TEMPLATES_DIR)
#     # 9) Generar colección Postman
#     generate_postman(json_path, OUTPUT_DIR)

#     # 5) Generar HealthController fijo
#     health_content = render_template(
#         os.path.join(TEMPLATES_DIR, "health_controller.java.j2"),
#         {"groupId": "com.test"}
#     )
#     with open(os.path.join(src_controllers, "HealthController.java"), "w", encoding="utf-8") as f:
#         f.write(health_content)
#     print("🌐 Controladores generados (CRUD + HealthCheck)")

#     # 6) Renderizar pom.xml
#     pom_content = render_template(
#         os.path.join(TEMPLATES_DIR, "pom.xml.j2"),
#         {"groupId": "com.test", "artifactId": "demo"}
#     )
#     with open(os.path.join(OUTPUT_DIR, "pom.xml"), "w", encoding="utf-8") as f:
#         f.write(pom_content)

#     # 7) Renderizar application.properties
#     props_content = render_template(
#         os.path.join(TEMPLATES_DIR, "application.properties.j2"),
#         {"db_name": "testdb", "db_user": "postgres", "db_pass": "1234"}
#     )
#     with open(os.path.join(resources, "application.properties"), "w", encoding="utf-8") as f:
#         f.write(props_content)

#     # 8) Clase principal
#     main_class_content = render_template(
#         os.path.join(TEMPLATES_DIR, "main.java.j2"),
#         {"groupId": "com.test", "artifactId": "demo"}
#     )

#     with open(os.path.join(src_main, "DemoApplication.java"), "w", encoding="utf-8") as f:
#         f.write(main_class_content)
#     print("🚀 Clase principal generada: DemoApplication.java")

#     print(f"✅ Proyecto generado en: {OUTPUT_DIR}")
    
# if __name__ == "__main__":
#     build_project("../json/diagram_367493a5-e490-4665-a73f-8626674b2ee2.json")
# exporters/generators/project_builder.py
import os
from exporters.generators.json_to_full_orm import generate_from_json
from exporters.generators.model_to_repository import generate_repositories
from exporters.generators.repository_to_service import generate_services
from exporters.generators.service_to_controller import generate_controllers
from exporters.generators.model_to_dto import generate_dtos
from exporters.generators.postman_generator import generate_postman

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")

def render_template(template_path, context):
    with open(template_path, "r", encoding="utf-8") as f:
        content = f.read().lstrip()
    for key, value in context.items():
        content = content.replace("{{ " + key + " }}", value)
    return content


def build_project(json_path: str, output_dir: str):
    src_main = os.path.join(output_dir, "src", "main", "java", "com", "test")
    src_models = os.path.join(src_main, "models")
    src_repositories = os.path.join(src_main, "repositories")
    src_services = os.path.join(src_main, "services")
    src_controllers = os.path.join(src_main, "controllers")
    src_dtos = os.path.join(src_main, "dtos")
    resources = os.path.join(output_dir, "src", "main", "resources")

    os.makedirs(src_main, exist_ok=True)
    os.makedirs(src_models, exist_ok=True)
    os.makedirs(src_repositories, exist_ok=True)
    os.makedirs(src_services, exist_ok=True)
    os.makedirs(src_controllers, exist_ok=True)
    os.makedirs(src_dtos, exist_ok=True)
    os.makedirs(resources, exist_ok=True)

    # 1) Generar modelos
    generate_from_json(json_path, src_models)

    # 2) Repositorios
    generate_repositories(json_path, src_repositories, TEMPLATES_DIR)

    # 3) Servicios
    generate_services(json_path, src_services, TEMPLATES_DIR)

    # 4) Controladores
    generate_controllers(json_path, src_controllers, TEMPLATES_DIR)

    # 5) DTOs
    generate_dtos(json_path, src_dtos, TEMPLATES_DIR)

    # 6) Postman
    generate_postman(json_path, output_dir)

    # 7) Archivos fijos (HealthController, pom.xml, application.properties, etc.)
    health_content = render_template(
        os.path.join(TEMPLATES_DIR, "health_controller.java.j2"),
        {"groupId": "com.test"}
    )
    with open(os.path.join(src_controllers, "HealthController.java"), "w", encoding="utf-8") as f:
        f.write(health_content)

    pom_content = render_template(
        os.path.join(TEMPLATES_DIR, "pom.xml.j2"),
        {"groupId": "com.test", "artifactId": "demo"}
    )
    with open(os.path.join(output_dir, "pom.xml"), "w", encoding="utf-8") as f:
        f.write(pom_content)

    props_content = render_template(
        os.path.join(TEMPLATES_DIR, "application.properties.j2"),
        {"db_name": "testdb", "db_user": "postgres", "db_pass": "1234"}
    )
    with open(os.path.join(resources, "application.properties"), "w", encoding="utf-8") as f:
        f.write(props_content)

    main_class_content = render_template(
        os.path.join(TEMPLATES_DIR, "main.java.j2"),
        {"groupId": "com.test", "artifactId": "demo"}
    )
    with open(os.path.join(src_main, "DemoApplication.java"), "w", encoding="utf-8") as f:
        f.write(main_class_content)

    print(f"✅ Proyecto generado en: {output_dir}")
