# app/services/ai_assistant.py
"""
Asistente de IA que edita el diagrama UML por comandos de texto/voz.

Regla de la catedra (no negociable): el asistente NUNCA genera el diagrama
completo a partir de un problema descrito. Solo ejecuta ediciones puntuales
sobre lo que el usuario le va pidiendo, una instruccion a la vez, usando las
tools de ai_tools.py -- las mismas operaciones que ya expone la API REST.

Flujo: texto del usuario -> Gemini decide que tool(s) llamar -> se ejecutan
contra la base de datos -> se le devuelve el resultado a Gemini -> Gemini
responde en lenguaje natural confirmando lo que hizo (o explicando por que
no pudo). El flujo web es sincrono: la voz se transcribe en el cliente (Web
Speech API) y llega aca ya como texto.

Usa Google Gemini (google-genai) en vez de un proveedor de pago: el
enunciado no exige un proveedor de IA en particular para el editor, y
Gemini tiene capa gratuita sin tarjeta.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

from google import genai

from app.core.config import settings
from app.models.uml import Diagram
from app.services.ai_tools import DiagramToolExecutor, ToolError, TOOLS

logger = logging.getLogger(__name__)

MODEL = "gemini-3.5-flash-lite"
MAX_TOOL_TURNS = 6  # tope de vueltas del loop para evitar bucles infinitos
REQUEST_TIMEOUT = 30.0  # segundos; evita que una request cuelgue indefinidamente

SYSTEM_PROMPT = """Sos el asistente de edicion de un editor colaborativo de \
diagramas de clases UML. Un disenador de software te da instrucciones en \
lenguaje natural (por texto o por voz ya transcripta) y vos las traducis en \
llamadas a las herramientas disponibles para editar el diagrama.

Reglas estrictas:
1. NUNCA disenies ni generes un diagrama completo a partir de un problema \
   descrito de forma general. Solo ejecutas ediciones puntuales y explicitas \
   que el usuario pide una por una (crear esta clase, agregar este atributo, \
   crear esta relacion, etc). Si el usuario te describe un problema entero y \
   te pide que "generes" o "arma" el modelo completo, respondé que tu rol es \
   ejecutar ediciones puntuales y pedile que te las de paso a paso.
2. Si el comando del usuario implica una o varias ediciones concretas y \
   bien definidas (ej: "creame una clase Cliente con nombre y email"), podes \
   encadenar varias llamadas a herramientas en la misma respuesta.
3. Si una herramienta falla (ej. no existe la clase referenciada), leé el \
   mensaje de error y decidí si podés corregir el pedido vos mismo (por \
   ejemplo el usuario escribio mal un nombre y hay uno muy parecido) o si \
   necesitas preguntarle al usuario.
4. Despues de ejecutar las herramientas, respondé siempre en español, breve \
   y confirmando exactamente que se hizo. No inventes cambios que no \
   hiciste.
5. Si el pedido no tiene nada que ver con editar el diagrama, respondé que \
   solo podes editar el diagrama de clases.
"""


@dataclass
class AiCommandResult:
    reply: str
    actions: list[dict] = field(default_factory=list)


def run_command(db, diagram: Diagram, user_text: str) -> AiCommandResult:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY no esta configurada en el backend (.env)."
        )

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    executor = DiagramToolExecutor(db, diagram)

    state = json.dumps(executor.snapshot(), ensure_ascii=False)
    prompt = (
        f"Estado actual del diagrama (JSON):\n{state}\n\n"
        f"Instruccion del usuario:\n{user_text}"
    )

    actions: list[dict] = []

    interaction = client.interactions.create(
        model=MODEL,
        input=prompt,
        system_instruction=SYSTEM_PROMPT,
        tools=TOOLS,
        timeout=REQUEST_TIMEOUT,
    )

    for _ in range(MAX_TOOL_TURNS):
        call_steps = [s for s in interaction.steps if s.type == "function_call"]
        if not call_steps:
            return AiCommandResult(reply=interaction.output_text or "Listo.", actions=actions)

        function_results = []
        for step in call_steps:
            logger.info(f"🤖 [AI TOOL] {step.name} -> {step.arguments}")
            try:
                fn = getattr(executor, step.name)
                result = fn(**step.arguments)
                actions.append({"tool": step.name, "input": step.arguments, "result": result})
                payload = json.dumps(result, ensure_ascii=False)
            except ToolError as e:
                payload = json.dumps({"error": str(e)}, ensure_ascii=False)
            except Exception as e:
                logger.error(f"❌ [AI TOOL] error ejecutando {step.name}: {e}")
                payload = json.dumps({"error": f"Error interno: {e}"}, ensure_ascii=False)

            function_results.append({
                "type": "function_result",
                "name": step.name,
                "call_id": step.id,
                "result": [{"type": "text", "text": payload}],
            })

        interaction = client.interactions.create(
            model=MODEL,
            input=function_results,
            tools=TOOLS,
            previous_interaction_id=interaction.id,
            timeout=REQUEST_TIMEOUT,
        )

    return AiCommandResult(
        reply="Se alcanzo el limite de pasos para este comando; intenta dividirlo en instrucciones mas simples.",
        actions=actions,
    )
