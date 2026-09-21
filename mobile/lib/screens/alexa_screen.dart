// lib/screens/alexa_screen.dart
//
// Modo "Alexa": solo un botón grande de micrófono y estados -- sin campo
// de texto ni botón de enviar. El flujo es enteramente por voz: Vosk
// (STT, ya integrado) escucha, el LLM local + parser determinista
// interpretan, y la respuesta se lee con TextToSpeech nativo (ver
// lib/voice/tts_service.dart), manteniendo también el texto visible por
// si el usuario prefiere leerlo.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';

import '../app_state.dart';
import '../services/local_llm_service.dart';
import '../uap/intent_parser.dart';
import '../uap/response_phrasing.dart';

const _uuid = Uuid();

enum _AlexaStage { idle, escuchando, interpretando, validando, esperandoConfirmacion, sincronizando, error }

class AlexaScreen extends StatefulWidget {
  const AlexaScreen({super.key});

  @override
  State<AlexaScreen> createState() => _AlexaScreenState();
}

class _AlexaScreenState extends State<AlexaScreen> {
  _AlexaStage _stage = _AlexaStage.idle;
  String _lastResponse = '';
  bool _spanishVoiceMissing = false;

  @override
  void initState() {
    super.initState();
    _checkVoice();
  }

  Future<void> _checkVoice() async {
    final app = context.read<AppState>();
    final hasSpanish = await app.tts.isSpanishVoiceAvailable();
    if (mounted) setState(() => _spanishVoiceMissing = !hasSpanish);
  }

  Future<void> _toggleListening() async {
    final app = context.read<AppState>();
    if (_stage == _AlexaStage.escuchando) {
      await app.speech.stopListening();
      return;
    }

    setState(() {
      _stage = _AlexaStage.escuchando;
      _lastResponse = '';
    });

    try {
      await app.speech.startListening(
        onPartial: (_) {},
        onFinal: (text) => _handleRecognized(text),
      );
    } catch (e) {
      setState(() {
        _stage = _AlexaStage.error;
        _lastResponse = 'No pude usar el micrófono: $e';
      });
    }
  }

  Future<void> _handleRecognized(String text) async {
    final app = context.read<AppState>();
    await app.speech.stopListening();
    setState(() => _stage = _AlexaStage.interpretando);

    final contract = app.contract;
    if (contract == null) {
      await _respond('Todavía no me conecté a ningún sistema.');
      return;
    }

    LlmDraft? draft;
    try {
      final llmResult = await app.llm.resolveUapCommand(
        userText: text,
        tools: contract.tools
            .map((t) => UapToolSummary(toolId: t.toolId, description: t.description, fieldNames: t.properties.keys.toList()))
            .toList(),
      );
      draft = LlmDraft(fields: llmResult.arguments);
    } catch (_) {
      draft = null;
    }

    setState(() => _stage = _AlexaStage.validando);
    final parser = IntentParser(contract);
    final result = parser.parse(text, draft: draft);

    switch (result) {
      case ParsedInvocation(:final toolId, :final input):
        setState(() => _stage = _AlexaStage.sincronizando);
        try {
          final tool = contract.toolsById[toolId]!;
          final entity = contract.manifest.entities.firstWhere((e) => e.key == tool.entityKey);
          final response = await app.uapClient!.invoke(toolId, input, clientRecordId: _uuid.v4());
          await _respond(phraseForResult(verb: tool.verb, entity: entity, result: response));
        } catch (e) {
          await _respond(phraseForBackendRejected(e.toString()));
        }
      case NeedsClarification(:final questionEs):
        setState(() => _stage = _AlexaStage.esperandoConfirmacion);
        await _respond(questionEs);
      case Rejected(:final reasonEs):
        await _respond('No pude determinar una única acción: $reasonEs');
    }
  }

  Future<void> _respond(String text) async {
    final app = context.read<AppState>();
    setState(() {
      _lastResponse = text;
      _stage = _AlexaStage.idle;
    });
    await app.tts.speak(text);
  }

  String get _stageLabel => switch (_stage) {
        _AlexaStage.idle => 'Tocá el micrófono para hablar',
        _AlexaStage.escuchando => 'Escuchando...',
        _AlexaStage.interpretando => 'Interpretando...',
        _AlexaStage.validando => 'Validando...',
        _AlexaStage.esperandoConfirmacion => 'Esperando tu confirmación',
        _AlexaStage.sincronizando => 'Sincronizando...',
        _AlexaStage.error => 'Ocurrió un problema',
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Asistente por voz')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (_spanishVoiceMissing)
              Card(
                color: Theme.of(context).colorScheme.errorContainer,
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text('No encontré una voz en español instalada en este teléfono. Vas a ver la respuesta escrita, pero no la voy a poder leer en voz alta.'),
                ),
              ),
            const Spacer(),
            GestureDetector(
              onTap: _toggleListening,
              child: CircleAvatar(
                radius: 64,
                backgroundColor: _stage == _AlexaStage.escuchando
                    ? Theme.of(context).colorScheme.error
                    : Theme.of(context).colorScheme.primary,
                child: Icon(
                  _stage == _AlexaStage.escuchando ? Icons.mic : Icons.mic_none,
                  size: 56,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text(_stageLabel, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 24),
            if (_lastResponse.isNotEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(_lastResponse, textAlign: TextAlign.center),
                ),
              ),
            const Spacer(),
          ],
        ),
      ),
    );
  }
}
