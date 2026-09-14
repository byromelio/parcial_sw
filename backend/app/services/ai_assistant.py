# app/services/ai_assistant.py
"""
Asistente de IA que edita el diagrama UML por comandos de texto/voz.

Regla de la catedra (no negociable): el asistente NUNCA genera el diagrama
completo a partir de un problema descrito. Solo ejecuta ediciones puntuales
sobre lo que el usuario le va pidiendo, una instruccion a la vez, usando las
tools de ai_tools.py -- las mismas operaciones que ya expone la API REST.

Flujo: texto del usuario -> Claude decide que tool(s) llamar -> se ejecutan
contra la base de datos -> se le devuelve el resultado a Claude -> Claude
responde en lenguaje natural confirmando lo que hizo (o explicando por que
no pudo). El flujo web es sincrono: la voz se transcribe en el cliente (Web
Speech API / equivalente) y llega aca ya como texto.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

import anthropic
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.uml import Diagram
from app.services.ai_tools import DiagramToolExecutor, ToolError, TOOLS

logger = logging.getLogger(__name__)

MODEL = "claude-opus-5"
MAX_TOOL_TURNS = 6  # tope de vueltas del loop para evitar bucles infinitos

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
   y en confirmando exactamente que se hizo. No inventes cambios que no \
   hiciste.
5. Si el pedido no tiene nada que ver con editar el diagrama, respondé que \
   solo podes editar el diagrama de clases.
"""


@dataclass
class AiCommandResult:
    reply: str
    actions: list[dict] = field(default_factory=list)


def run_command(db: Session, diagram: Diagram, user_text: str) -> AiCommandResult:
    if not settings.ANTHROPIC_API_KEY:
        raise RuntimeError(
            "ANTHROPIC_API_KEY no esta configurada en el backend (.env)."
        )

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    executor = DiagramToolExecutor(db, diagram)

    state = json.dumps(executor.snapshot(), ensure_ascii=False)
    messages: list[dict] = [
        {
            "role": "user",
            "content": (
                f"Estado actual del diagrama (JSON):\n{state}\n\n"
                f"Instruccion del usuario:\n{user_text}"
            ),
        }
    ]

    actions: list[dict] = []

    for _ in range(MAX_TOOL_TURNS):
        response = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        if response.stop_reason != "tool_use":
            final_text = "".join(b.text for b in response.content if b.type == "text").strip()
            return AiCommandResult(reply=final_text or "Listo.", actions=actions)

        messages.append({"role": "assistant", "content": response.content})

        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue

            logger.info(f"🤖 [AI TOOL] {block.name} -> {block.input}")
            try:
                fn = getattr(executor, block.name)
                result = fn(**block.input)
                actions.append({"tool": block.name, "input": block.input, "result": result})
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })
            except ToolError as e:
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": str(e),
                    "is_error": True,
                })
            except Exception as e:
                logger.error(f"❌ [AI TOOL] error ejecutando {block.name}: {e}")
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": f"Error interno ejecutando la herramienta: {e}",
                    "is_error": True,
                })

        messages.append({"role": "user", "content": tool_results})

    return AiCommandResult(
        reply="Se alcanzo el limite de pasos para este comando; intenta dividirlo en instrucciones mas simples.",
        actions=actions,
    )
