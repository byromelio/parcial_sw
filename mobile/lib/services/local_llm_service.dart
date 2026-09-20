// lib/services/local_llm_service.dart
//
// Asistente de edición del diagrama corriendo ENTERAMENTE en el teléfono,
// sin red: un modelo de lenguaje chico (Qwen2.5-1.5B-Instruct, cuantizado
// GGUF Q4_K_M, ~1GB) vía llamadart (bindings de llama.cpp), con el mismo
// contrato de "tools" que ya usa el asistente web con Gemini
// (backend/app/services/ai_tools.py) -- mismo prompt, mismas operaciones,
// mismo límite ("nunca generar el diagrama completo, solo ediciones
// puntuales que el usuario ya pidió").
//
// Elegimos NO depender de la feature de "structured output"/tool-calling
// nativa del paquete (todavía cambia de versión en versión): en cambio le
// pedimos al modelo, por prompt, que responda un único objeto JSON con la
// función a llamar y sus argumentos, y lo parseamos acá con un extractor
// tolerante a texto extra alrededor (el modelo a veces agrega explicación
// antes/después del JSON a pesar de la instrucción). Es el mismo patrón
// defensivo que "function calling manual" en cualquier LLM sin soporte
// nativo confiable.

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

  static const _systemPrompt = '''
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

  /// Descarga (si hace falta) y carga el modelo. Llamar una sola vez al
  /// abrir el asistente por primera vez en la sesión.
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
  /// devuelve la llamada a función que el modelo decidió hacer.
  Future<LlmToolCall> resolveCommand({
    required String userText,
    required Map<String, dynamic> diagramSnapshot,
  }) async {
    if (!_loaded || _engine == null) {
      throw StateError('El modelo local todavía no está cargado.');
    }

    final prompt = '''
Estado actual del diagrama (JSON): ${jsonEncode(diagramSnapshot)}

Instrucción del usuario: $userText
''';

    final buffer = StringBuffer();
    await for (final token in _engine!.generate(
      prompt,
      systemPrompt: _systemPrompt,
      maxTokens: 200,
      temperature: 0.1, // determinístico: esto es function-calling, no charla
    )) {
      buffer.write(token);
    }

    return _parseToolCall(buffer.toString());
  }

  LlmToolCall _parseToolCall(String raw) {
    // El modelo a veces envuelve el JSON en ```json ... ``` o agrega texto
    // alrededor a pesar de la instrucción: se busca el primer objeto JSON
    // balanceado en el texto en vez de asumir que la respuesta es JSON puro.
    final start = raw.indexOf('{');
    if (start == -1) {
      throw FormatException('El modelo no devolvió un JSON reconocible: $raw');
    }
    var depth = 0;
    var end = -1;
    for (var i = start; i < raw.length; i++) {
      if (raw[i] == '{') depth++;
      if (raw[i] == '}') {
        depth--;
        if (depth == 0) {
          end = i;
          break;
        }
      }
    }
    if (end == -1) {
      throw FormatException('JSON incompleto en la respuesta del modelo: $raw');
    }

    final jsonStr = raw.substring(start, end + 1);
    final data = jsonDecode(jsonStr) as Map<String, dynamic>;
    final tool = data['tool'] as String?;
    final args = (data['args'] as Map?)?.cast<String, dynamic>() ?? {};
    if (tool == null) {
      throw FormatException('La respuesta no tiene el campo "tool": $jsonStr');
    }
    return LlmToolCall(tool, args);
  }
}
