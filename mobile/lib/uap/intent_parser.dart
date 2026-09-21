// lib/uap/intent_parser.dart
//
// El parser determinista es la AUTORIDAD sobre qué operación se ejecuta
// contra un backend UAP -- nunca el LLM local. El LLM (ver
// LocalLlmService.resolveUapCommand) solo PROPONE un borrador
// {tool, args} a partir del texto libre del usuario; este parser valida
// ese borrador contra el UapContract real (descubierto en runtime) y, si
// el LLM no dio un borrador utilizable, intenta resolver la intención por
// su cuenta con reglas fijas sobre el texto crudo. En ningún caso se
// ejecuta un toolId o un campo que no exista en el contrato descubierto.
//
// Todo el pipeline es sincrónico, sin red y sin el LLM adentro: es lo que
// permite testear cada regla (alias en español, plurales, sanitización,
// coerción) de forma aislada y determinista.

import 'type_coercion.dart';
import 'uap_manifest.dart';

sealed class ParseResult {}

class ParsedInvocation extends ParseResult {
  final String toolId;
  final Map<String, dynamic> input;
  ParsedInvocation(this.toolId, this.input);
}

class NeedsClarification extends ParseResult {
  final String questionEs;
  NeedsClarification(this.questionEs);
}

class Rejected extends ParseResult {
  final String reasonEs;
  Rejected(this.reasonEs);
}

/// Lo que el LLM local propone antes de que el parser lo valide -- mismo
/// shape que ya produce LocalLlmService.resolveCommand para el diagramador
/// (ver LlmToolCall), reusado acá para el flujo UAP.
class LlmDraft {
  final String? entityHint; // lo que el LLM entendio como la entidad (puede venir mal)
  final String? verbHint; // lo que el LLM entendio como el verbo (puede venir mal)
  final Map<String, dynamic> fields;
  LlmDraft({this.entityHint, this.verbHint, this.fields = const {}});
}

const Map<String, String> _verbAliases = {
  // create
  'crear': 'create', 'crea': 'create', 'creá': 'create',
  'registrar': 'create', 'registra': 'create', 'registrá': 'create',
  'agregar': 'create', 'agrega': 'create', 'agregá': 'create',
  'añadir': 'create', 'añade': 'create', 'añadí': 'create',
  'nuevo': 'create', 'nueva': 'create', 'anotar': 'create', 'anotá': 'create',
  // list
  'listar': 'list', 'lista': 'list', 'listame': 'list', 'listá': 'list',
  'mostrar': 'list', 'muestra': 'list', 'mostrame': 'list',
  'ver': 'list', 'dame': 'list', 'cuales': 'list', 'cuáles': 'list',
  // get
  'consultar': 'get', 'consulta': 'get', 'consultá': 'get',
  'obtener': 'get', 'obtené': 'get', 'buscar': 'get', 'buscá': 'get',
  'traer': 'get', 'traé': 'get',
  // update
  'actualizar': 'update', 'actualizá': 'update', 'actualiza': 'update',
  'modificar': 'update', 'modificá': 'update', 'modifica': 'update',
  'cambiar': 'update', 'cambiá': 'update', 'cambia': 'update',
  'editar': 'update', 'editá': 'update', 'corregir': 'update', 'corregí': 'update',
  // delete
  'eliminar': 'delete', 'eliminá': 'delete', 'elimina': 'delete',
  'borrar': 'delete', 'borrá': 'delete', 'borra': 'delete',
  'quitar': 'delete', 'quitá': 'delete',
};

// Patrones que nunca deben aparecer en un valor de campo -- ni siquiera
// como texto libre. No son una lista de "malas palabras" sino un intento
// de reconocer que el valor dejó de ser un dato y pasó a ser una
// instrucción/payload (URL arbitraria, SQL, shell, reflexión de Java).
final List<RegExp> _forbiddenValuePatterns = [
  RegExp(r'https?://', caseSensitive: false),
  RegExp(r';\s*--'),
  RegExp(r'\b(drop|select|insert|delete\s+from|union)\b', caseSensitive: false),
  RegExp(r'`|\$\(|&&|\|\|'),
  RegExp(r'class\.forname|getdeclaredmethod|\.invoke\(', caseSensitive: false),
];

String _stripAccents(String s) {
  const from = 'áéíóúÁÉÍÓÚñÑ';
  const to = 'aeiouAEIOUnN';
  var out = s;
  for (var i = 0; i < from.length; i++) {
    out = out.replaceAll(from[i], to[i]);
  }
  return out;
}

/// Singular<->plural español simplificado: suficiente para lo que un
/// manifest UAP declara (nombres de entidad simples, sin plurales
/// irregulares como "lápiz"->"lápices" en la mayoría de los dominios de
/// examen). No pretende ser un lematizador completo del idioma.
List<String> _candidateSingularsAndPlurals(String word) {
  final w = word.toLowerCase();
  final candidates = <String>{w};
  if (w.endsWith('es') && w.length > 3) candidates.add(w.substring(0, w.length - 2));
  if (w.endsWith('s') && w.length > 2) candidates.add(w.substring(0, w.length - 1));
  candidates.add('${w}s');
  candidates.add('${w}es');
  return candidates.toList();
}

int _levenshtein(String a, String b) {
  final dp = List.generate(a.length + 1, (_) => List.filled(b.length + 1, 0));
  for (var i = 0; i <= a.length; i++) {
    dp[i][0] = i;
  }
  for (var j = 0; j <= b.length; j++) {
    dp[0][j] = j;
  }
  for (var i = 1; i <= a.length; i++) {
    for (var j = 1; j <= b.length; j++) {
      final cost = a[i - 1] == b[j - 1] ? 0 : 1;
      dp[i][j] = [dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost].reduce((x, y) => x < y ? x : y);
    }
  }
  return dp[a.length][b.length];
}

class IntentParser {
  final UapContract contract;
  IntentParser(this.contract);

  ParseResult parse(String userText, {LlmDraft? draft}) {
    final normalized = _stripAccents(userText.toLowerCase()).trim();
    if (normalized.isEmpty) return Rejected('No entendí ningún pedido.');

    final entity = _resolveEntity(normalized, draft?.entityHint);
    if (entity == null) {
      return Rejected(
        'No reconozco esa entidad en este sistema. Las que existen son: '
        '${contract.manifest.entities.map((e) => e.label).join(', ')}.',
      );
    }

    final verb = _resolveVerb(normalized, draft?.verbHint);
    if (verb == null) {
      return NeedsClarification('¿Qué querés hacer con ${entity.plural}: crear, listar, consultar, actualizar o eliminar?');
    }

    final tool = contract.toolFor(verb, entity.key);
    if (tool == null) {
      return Rejected(
        'Ese backend no permite "$verb" sobre ${entity.label}. '
        'Las operaciones disponibles son: ${contract.tools.where((t) => t.entityKey == entity.key).map((t) => t.verb).join(', ')}.',
      );
    }

    final draftFields = draft?.fields ?? const {};
    for (final key in draftFields.keys) {
      if (!tool.properties.containsKey(key)) {
        return Rejected(
          'El campo "$key" no existe para ${entity.label}. '
          'Los campos válidos son: ${tool.properties.keys.join(', ')}.',
        );
      }
    }

    final coercedInput = <String, dynamic>{};
    for (final entry in draftFields.entries) {
      final raw = entry.value;
      if (raw is String) {
        for (final pattern in _forbiddenValuePatterns) {
          if (pattern.hasMatch(raw)) {
            return Rejected('El valor de "${entry.key}" contiene algo que no puedo aceptar como dato.');
          }
        }
      }
      final schema = tool.properties[entry.key]!;
      final result = coerce(declaredType: schema.type, format: schema.format, raw: raw);
      switch (result) {
        case Coerced(:final value):
          coercedInput[entry.key] = value;
        case CoercionFailed(:final messageEs):
          return NeedsClarification(messageEs);
      }
    }

    final missing = tool.required.where((f) => !coercedInput.containsKey(f)).toList();
    if (missing.isNotEmpty) {
      return NeedsClarification('Me falta el campo "${missing.first}" para ${_verbDescriptionEs(verb)} ${entity.label}.');
    }

    return ParsedInvocation(tool.toolId, coercedInput);
  }

  UapEntity? _resolveEntity(String normalizedText, String? hint) {
    if (hint != null) {
      final byHint = contract.entitiesByAlias[_stripAccents(hint.toLowerCase())];
      if (byHint != null) return byHint;
    }
    // Buscar cualquier alias conocido (o su singular/plural) como palabra
    // dentro del texto normalizado.
    for (final alias in contract.entitiesByAlias.keys) {
      for (final candidate in _candidateSingularsAndPlurals(alias)) {
        if (normalizedText.contains(candidate)) return contract.entitiesByAlias[alias];
      }
    }
    // Tolerancia a typos: distancia de edicion <= 1 contra cada palabra
    // del texto para cada alias conocido.
    final words = normalizedText.split(RegExp(r'\s+'));
    for (final word in words) {
      for (final alias in contract.entitiesByAlias.keys) {
        if (_levenshtein(word, alias) <= 1) return contract.entitiesByAlias[alias];
      }
    }
    return null;
  }

  String? _resolveVerb(String normalizedText, String? hint) {
    if (hint != null) {
      final h = _stripAccents(hint.toLowerCase());
      if (_verbAliases.containsValue(h)) return h; // el LLM ya devolvio el verbo canonico
      if (_verbAliases.containsKey(h)) return _verbAliases[h];
    }
    for (final word in normalizedText.split(RegExp(r'\s+'))) {
      if (_verbAliases.containsKey(word)) return _verbAliases[word];
    }
    return null;
  }

  String _verbDescriptionEs(String verb) => switch (verb) {
        'create' => 'crear',
        'list' => 'listar',
        'get' => 'consultar',
        'update' => 'actualizar',
        'delete' => 'eliminar',
        _ => verb,
      };
}
