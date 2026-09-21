import 'package:flutter_test/flutter_test.dart';
import 'package:uml_collab_mobile/services/local_llm_service.dart';

void main() {
  group('extractFirstJsonObject', () {
    test('extrae un JSON limpio', () {
      final result = extractFirstJsonObject('{"tool": "create_class", "args": {}}');
      expect(result, '{"tool": "create_class", "args": {}}');
    });

    test('ignora texto antes y despues del JSON', () {
      final result = extractFirstJsonObject('Claro, acá está: {"tool": "list_producto", "args": {}} espero que ayude');
      expect(result, '{"tool": "list_producto", "args": {}}');
    });

    test('maneja bloques de codigo markdown alrededor', () {
      final result = extractFirstJsonObject('```json\n{"tool": "get_cliente", "args": {"id": 1}}\n```');
      expect(result, '{"tool": "get_cliente", "args": {"id": 1}}');
    });

    test('respeta llaves anidadas balanceadas', () {
      final result = extractFirstJsonObject('{"tool": "create_producto", "args": {"nombre": "x", "meta": {"a": 1}}}');
      expect(result, '{"tool": "create_producto", "args": {"nombre": "x", "meta": {"a": 1}}}');
    });

    test('sin ningun JSON devuelve null', () {
      expect(extractFirstJsonObject('no entendí el pedido'), isNull);
    });

    test('JSON incompleto (sin cierre) devuelve null', () {
      expect(extractFirstJsonObject('{"tool": "create_class"'), isNull);
    });
  });

  group('parseToolCallFromRaw', () {
    test('parsea tool y args correctamente', () {
      final call = parseToolCallFromRaw('{"tool": "create_class", "args": {"name": "Cliente"}}');
      expect(call.tool, 'create_class');
      expect(call.arguments['name'], 'Cliente');
    });

    test('sin campo tool lanza FormatException', () {
      expect(() => parseToolCallFromRaw('{"args": {}}'), throwsFormatException);
    });

    test('sin ningun JSON lanza FormatException', () {
      expect(() => parseToolCallFromRaw('no entendí nada'), throwsFormatException);
    });

    test('args ausente se trata como mapa vacio', () {
      final call = parseToolCallFromRaw('{"tool": "list_producto"}');
      expect(call.arguments, isEmpty);
    });
  });
}
