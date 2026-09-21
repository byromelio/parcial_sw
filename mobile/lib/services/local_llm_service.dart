// lib/services/local_llm_service.dart
//
// Asistente de IA corriendo ENTERAMENTE en el teléfono, sin red: un
// modelo de lenguaje chico (Gemma 3 1B IT, cuantizado GGUF Q4_K_M,
// empaquetado dentro del propio APK -- ver lib/services/model_downloader.dart)
// vía llamadart (bindings de llama.cpp).
//
// Esta clase se usa de DOS formas distintas:
// - resolveCommand(): el contrato original, específico del diagramador
//   (9 tools fijas: create_class, add_attribute, etc, ver ai_tools.py del
//   backend FastAPI). Se mantiene intacto, ese flujo sigue funcionando
//   igual que antes.
// - resolveUapCommand(): contrato genérico para CUALQUIER backend Spring
//   Boot generado (protocolo UAP, ver lib/uap/): el LLM nunca conoce las
//   tools de antemano, se le pasan las descubiertas en runtime contra ese
//   backend puntual. Un solo modelo, dos "modos" de prompt.
//
// En ambos casos, el LLM solo PROPONE {tool, args}: la autoridad real
// sobre qué tools existen y si los argumentos son válidos es siempre el
// parser determinista (ver lib/uap/intent_parser.dart para el caso UAP).
//
// Elegimos NO depender de tool-calling nativo del paquete (todavía cambia
// de versión en versión, y Gemma 3 no tiene un rol "system" real en su
// chat template): en cambio se le pide al modelo, por prompt, que
// responda un único objeto JSON con la función a llamar y sus
// argumentos, y se parsea acá con un extractor tolerante a texto extra
// alrededor (el modelo a veces agrega explicación antes/después del JSON
// a pesar de la instrucción). Es el mismo patrón defensivo que "function
// calling manual" en cualquier LLM sin soporte nativo confiable.

import 'dart:convert';
import 'package:llamadart/llamadart.dart';

class LlmToolCall {
  final String tool;
  final Map<String, dynamic> arguments;
  LlmToolCall(this.tool, this.arguments);
}

class LocalLlmService {
  LlamaEngine? _engine;
  bool _loaded = false;

  bool get isLoaded => _loaded;

  static const _diagramSystemPrompt = '''
Sos un asistente que edita un diagrama de clases UML por instrucciones en
lenguaje natural. NUNCA generás el diagrama completo a partir de la
descripción de un problema: solo ejecutás la edición puntual que el usuario
te pide, una a la vez.

Herramientas disponibles (respondé SIEMPRE con un JSON de una de estas
formas, sin texto antes ni después):

{"tool": "create_class", "args": {"name": "Cliente"}}
{"tool": "add_attribute", "args": {"class_name": "Cliente", "name": "email", "type": "String", "required": false}}
{"tool": "add_method", "args": {"class_name": "Cliente", "name": "comprar", "return_type": "void"}}
{"tool": "create_relation", "args": {"from_class": "Cliente", "to_class": "Pedido", "type": "ASSOCIATION", "src_multiplicity": "1", "dst_multiplicity": "1..*"}}
{"tool": "rename_class", "args": {"class_name": "Cliente", "new_name": "Usuario"}}
{"tool": "delete_class", "args": {"class_name": "Cliente"}}
{"tool": "delete_attribute", "args": {"class_name": "Cliente", "attribute_name": "email"}}
{"tool": "delete_method", "args": {"class_name": "Cliente", "method_name": "comprar"}}
{"tool": "delete_relation", "args": {"from_class": "Cliente", "to_class": "Pedido"}}

Tipos de relación válidos: ASSOCIATION, AGGREGATION, COMPOSITION,
INHERITANCE, DEPENDENCY. Si no aclaran el tipo de atributo, usá "String"
para texto, "Integer" para números enteros, "Double" para montos, "Boolean"
para sí/no, "LocalDate" para fechas.

Si el pedido describe un problema general y te pide que VOS decidas qué
clases o relaciones debería tener el sistema (ej. "armame el diagrama de
una veterinaria"), respondé exactamente:
{"tool": "clarify", "args": {"message": "Decime qué clases, atributos o relaciones concretas querés que cree."}}
''';

  /// Copia (si hace falta) y carga el modelo. Llamar una sola vez al abrir
  /// el asistente por primera vez en la sesión.
  Future<void> load(String modelPath) async {
    if (_loaded) return;
    _engine = LlamaEngine(LlamaBackend());
    await _engine!.loadModel(modelPath);
    _loaded = true;
  }

  Future<void> dispose() async {
    await _engine?.dispose();
    _engine = null;
    _loaded = false;
  }

  /// Le pasa el estado actual del diagrama (clases/relaciones existentes,
  /// igual que hace el backend con Gemini) y la instrucción del usuario, y
  /// devuelve la llamada a función que el modelo decidió hacer. Contrato
  /// fijo del diagramador -- no se toca al agregar soporte UAP.
  Future<LlmToolCall> resolveCommand({
    required String userText,
    required Map<String, dynamic> diagramSnapshot,
  }) async {
    final prompt = '''
$_diagramSystemPrompt

Estado actual del diagrama (JSON): ${jsonEncode(diagramSnapshot)}

Instrucción del usuario: $userText
''';
    return parseToolCallFromRaw(await _generate(prompt));
  }

  /// Igual que resolveCommand, pero para un backend UAP genérico: las
  /// tools disponibles NO están hardcodeadas, se arman en runtime a partir
  /// de lo que ese backend puntual expuso en /uap/v1/tools. El resultado
  /// sigue siendo solo una PROPUESTA -- ver IntentParser, que es quien
  /// valida esto antes de ejecutar nada.
  Future<LlmToolCall> resolveUapCommand({
    required String userText,
    required List<UapToolSummary> tools,
  }) async {
    final toolsDescription = tools.map((t) => '- ${t.toolId}: ${t.description} (campos: ${t.fieldNames.join(', ')})').join('\n');

    final prompt = '''
Sos un asistente que ejecuta operaciones sobre un sistema, a partir de
instrucciones en lenguaje natural en español. Solo podés usar las
herramientas listadas abajo -- si el pedido no corresponde a ninguna,
respondé {"tool": "unknown", "args": {}}.

Herramientas disponibles:
$toolsDescription

Respondé SIEMPRE con un único JSON, sin texto antes ni después, con esta
forma exacta:
{"tool": "<toolId de la lista>", "args": {"campo": "valor", ...}}

No inventes campos que no estén en la lista de la herramienta elegida.

Instrucción del usuario: $userText
''';
    return parseToolCallFromRaw(await _generate(prompt));
  }

  Future<String> _generate(String prompt) async {
    if (!_loaded || _engine == null) {
      throw StateError('El modelo local todavía no está cargado.');
    }
    final buffer = StringBuffer();
    // maxTokens/temp van dentro de GenerationParams en la API real de
    // llamadart (no como parametros sueltos de generate()) -- temp bajo
    // porque esto es function-calling, no charla libre.
    await for (final token in _engine!.generate(
      prompt,
      params: const GenerationParams(maxTokens: 200, temp: 0.1),
    )) {
      buffer.write(token);
    }
    return buffer.toString();
  }
}

/// Resumen mínimo de una tool UAP que el LLM necesita ver en el prompt --
/// no se le pasa el UapTool completo (con todo el detalle de tipos JSON-
/// Schema) para no inflar el prompt de un modelo tan chico como Gemma 1B.
class UapToolSummary {
  final String toolId;
  final String description;
  final List<String> fieldNames;
  UapToolSummary({required this.toolId, required this.description, required this.fieldNames});
}

/// Extrae un LlmToolCall del texto crudo que devolvió el modelo. Función
/// de nivel superior (no un método de instancia) para poder testearla sin
/// cargar ningún modelo real.
LlmToolCall parseToolCallFromRaw(String raw) {
  final jsonStr = extractFirstJsonObject(raw);
  if (jsonStr == null) {
    throw FormatException('El modelo no devolvió un JSON reconocible: $raw');
  }
  final data = jsonDecode(jsonStr) as Map<String, dynamic>;
  final tool = data['tool'] as String?;
  final args = (data['args'] as Map?)?.cast<String, dynamic>() ?? {};
  if (tool == null) {
    throw FormatException('La respuesta no tiene el campo "tool": $jsonStr');
  }
  return LlmToolCall(tool, args);
}

/// Busca el primer objeto JSON balanceado dentro de un texto -- el modelo
/// a veces envuelve el JSON en ```json ... ``` o agrega texto alrededor a
/// pesar de la instrucción, así que no se puede asumir que la respuesta
/// entera es JSON puro. Función pura y pública: es lo que permite
/// testear el extractor sin cargar ningún modelo.
String? extractFirstJsonObject(String raw) {
  final start = raw.indexOf('{');
  if (start == -1) return null;
  var depth = 0;
  for (var i = start; i < raw.length; i++) {
    if (raw[i] == '{') depth++;
    if (raw[i] == '}') {
      depth--;
      if (depth == 0) return raw.substring(start, i + 1);
    }
  }
  return null;
}
