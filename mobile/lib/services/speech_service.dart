// lib/services/speech_service.dart
//
// Reconocimiento de voz offline con Vosk (modelo español chico, ~50MB).
// SpeechService de vosk_flutter_2 ya maneja el micrófono y el streaming de
// audio: acá solo se expone como Stream de texto reconocido para que la
// pantalla del asistente lo consuma con un StreamBuilder.

import 'package:vosk_flutter_2/vosk_flutter_2.dart';

class SpeechRecognitionService {
  final _vosk = VoskFlutterPlugin.instance();
  Model? _model;
  Recognizer? _recognizer;
  SpeechService? _speechService;
  bool _ready = false;

  bool get isReady => _ready;
  bool get isListening => _speechService?.recognitionStarted ?? false;

  /// Carga el modelo Vosk español desde una carpeta ya descargada en el
  /// dispositivo (ver ModelDownloader). Se llama una vez al abrir el
  /// asistente por primera vez en la sesión.
  Future<void> load(String modelPath) async {
    if (_ready) return;
    _model = await _vosk.createModel(modelPath);
    _recognizer = await _vosk.createRecognizer(model: _model!, sampleRate: 16000);
    _speechService = await _vosk.initSpeechService(_recognizer!);
    _ready = true;
  }

  /// Empieza a escuchar el micrófono. `onPartial` recibe texto parcial
  /// mientras la persona sigue hablando (para feedback visual en vivo);
  /// `onFinal` recibe la frase completa cuando detecta una pausa.
  Future<void> startListening({
    required void Function(String partialText) onPartial,
    required void Function(String finalText) onFinal,
  }) async {
    if (!_ready || _speechService == null) {
      throw StateError('El reconocimiento de voz todavía no está cargado.');
    }
    _speechService!.onPartial().listen((jsonStr) {
      final text = _extractText(jsonStr, key: 'partial');
      if (text.isNotEmpty) onPartial(text);
    });
    _speechService!.onResult().listen((jsonStr) {
      final text = _extractText(jsonStr, key: 'text');
      if (text.isNotEmpty) onFinal(text);
    });
    await _speechService!.start();
  }

  Future<void> stopListening() async {
    await _speechService?.stop();
  }

  Future<void> dispose() async {
    await _speechService?.stop();
    await _recognizer?.dispose();
    await _model?.dispose();
    _ready = false;
  }

  /// Vosk devuelve JSON crudo tipo {"partial": "..."} o {"text": "..."}.
  /// A veces el valor es "nun" cuando no reconoció nada: se descarta.
  String _extractText(String jsonStr, {required String key}) {
    final match = RegExp('"$key"\\s*:\\s*"([^"]*)"').firstMatch(jsonStr);
    final text = match?.group(1)?.trim() ?? '';
    if (text.isEmpty || text == 'nun') return '';
    return text;
  }
}
