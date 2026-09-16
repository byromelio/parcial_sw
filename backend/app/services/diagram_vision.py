# app/services/diagram_vision.py
"""
Detecta un diagrama de clases UML dibujado a mano (foto de pizarra/papel) y
lo convierte a la misma estructura que ya usan el asistente de IA y el
import de XMI: clases con atributos, y relaciones con su tipo y
multiplicidad.

Distinto del asistente de edicion (ai_assistant.py): aca no hay ninguna
decision de diseño de parte de la IA -- el diagrama ya existe, dibujado por
una persona en la pizarra, y el modelo solo transcribe lo que ve a datos
estructurados. La restriccion de la catedra ("no generar el diagrama
completo") es sobre inventar un modelo a partir de la descripcion de un
problema; leer una imagen de algo que un humano ya diseño es una
digitalizacion, no un diseño.

El resultado nunca se aplica directo a un diagrama: el router lo devuelve
para que el usuario lo revise (y corrija errores de lectura) en el
frontend antes de confirmarlo.
"""
from __future__ import annotations

import json
import logging
import time

from google import genai
from google.genai import types

from app.core.config import settings
from app.schemas.vision import DetectedAttribute, DetectedClass, DetectedRelation, VisionDetectResult

logger = logging.getLogger(__name__)

MODEL = "gemini-3.5-flash"  # mejor lectura de imagen que el -lite para este caso
REQUEST_TIMEOUT = 60.0

SYSTEM_PROMPT = """Sos un asistente que transcribe un diagrama de clases UML \
dibujado a mano (en una foto de pizarra o papel) a datos estructurados.

El diagrama YA fue diseñado por una persona: tu trabajo es solo leerlo con \
precision, no inventar ni completar nada que no este dibujado.

Para cada clase (rectangulo dividido en nombre / atributos / metodos):
- Tomá el nombre de la clase tal cual está escrito.
- Los atributos van en la sección del medio del rectángulo. Para cada uno, \
  identificá su nombre y, si está anotado (después de ":"), su tipo.
- Si el tipo no está escrito, usá "string" por defecto.
- Un atributo subrayado o marcado como "id" suele ser la clave primaria: \
  marcalo con type="integer" o "uuid" según corresponda, y required=true.
- Ignorá la sección de métodos: no la transcribas como atributos.

Para cada relación (línea entre dos rectángulos):
- Identificá las dos clases que conecta.
- Identificá el tipo según la notación UML estándar en la punta de la línea:
  - Sin símbolo en la punta: ASSOCIATION
  - Flecha hueca (triángulo sin rellenar): INHERITANCE (va del hijo al padre)
  - Rombo hueco: AGGREGATION (el rombo está del lado del "todo")
  - Rombo relleno: COMPOSITION (el rombo está del lado del "todo")
  - Línea punteada con flecha simple: DEPENDENCY
  - Si no podés distinguir el símbolo con claridad, usá ASSOCIATION.
- Si hay números de multiplicidad escritos en las puntas (ej "1", "0..1", \
  "1..*", "*"), transcribilos tal cual. Si no hay ninguno escrito, dejalo \
  vacío (no inventes "1").

Si la imagen no muestra un diagrama de clases reconocible, devolvé listas \
vacías y un mensaje breve en "warning" explicando qué se ve en cambio.
"""

_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "classes": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING"},
                    "attributes": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "name": {"type": "STRING"},
                                "type": {"type": "STRING"},
                                "required": {"type": "BOOLEAN"},
                            },
                            "required": ["name"],
                        },
                    },
                },
                "required": ["name"],
            },
        },
        "relations": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "from_class": {"type": "STRING"},
                    "to_class": {"type": "STRING"},
                    "type": {
                        "type": "STRING",
                        "enum": ["ASSOCIATION", "AGGREGATION", "COMPOSITION", "INHERITANCE", "DEPENDENCY"],
                    },
                    "label": {"type": "STRING"},
                    "src_multiplicity": {"type": "STRING"},
                    "dst_multiplicity": {"type": "STRING"},
                },
                "required": ["from_class", "to_class", "type"],
            },
        },
        "warning": {"type": "STRING"},
    },
    "required": ["classes", "relations"],
}


def detect_from_image(image_bytes: bytes, mime_type: str) -> VisionDetectResult:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY no esta configurada en el backend (.env).")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # La capa gratuita de Gemini devuelve 503 "high demand" con bastante
    # frecuencia y es tipicamente transitorio (segundos): un par de
    # reintentos cortos con backoff evitan mandar al usuario un error por
    # algo que se resuelve solo con otro intento inmediato.
    last_error: Exception | None = None
    max_attempts = 4
    for attempt in range(max_attempts):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=[
                    SYSTEM_PROMPT,
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=_RESPONSE_SCHEMA,
                    http_options=types.HttpOptions(timeout=int(REQUEST_TIMEOUT * 1000)),
                ),
            )
            break
        except Exception as e:
            last_error = e
            is_unavailable = "UNAVAILABLE" in str(e) or "503" in str(e)
            if not is_unavailable or attempt == max_attempts - 1:
                raise
            wait_s = 3 * (attempt + 1)
            logger.warning(f"[vision] intento {attempt + 1} fallo (503), reintentando en {wait_s}s...")
            time.sleep(wait_s)
    else:
        raise last_error

    raw = response.text or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"[vision] respuesta no parseable como JSON: {raw[:500]!r}")
        raise RuntimeError("El asistente no pudo leer la imagen correctamente. Probá con otra foto, más nítida.")

    classes = [
        DetectedClass(
            name=c.get("name", "").strip(),
            attributes=[
                DetectedAttribute(
                    name=a.get("name", "").strip(),
                    type=(a.get("type") or "string").strip().lower(),
                    required=bool(a.get("required", False)),
                )
                for a in c.get("attributes", [])
                if a.get("name")
            ],
        )
        for c in data.get("classes", [])
        if c.get("name")
    ]
    relations = [
        DetectedRelation(
            from_class=r["from_class"].strip(),
            to_class=r["to_class"].strip(),
            type=(r.get("type") or "ASSOCIATION").strip().upper(),
            label=(r.get("label") or "").strip() or None,
            src_multiplicity=(r.get("src_multiplicity") or "").strip() or None,
            dst_multiplicity=(r.get("dst_multiplicity") or "").strip() or None,
        )
        for r in data.get("relations", [])
        if r.get("from_class") and r.get("to_class")
    ]

    return VisionDetectResult(
        classes=classes,
        relations=relations,
        warning=(data.get("warning") or "").strip() or None,
    )
