// lib/screens/historial_screen.dart
//
// Modo "Historial": chat con entrada de texto, historial conversacional y
// resultados en frases legibles -- sin micrófono (eso es el modo Alexa,
// ver alexa_screen.dart). Toda respuesta pasa por response_phrasing.dart:
// nunca se muestra JSON crudo como respuesta principal.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';

import '../app_state.dart';
import '../services/local_llm_service.dart';
import '../uap/connection_manager.dart';
import '../uap/intent_parser.dart';
import '../uap/response_phrasing.dart';
import 'alexa_screen.dart';

const _uuid = Uuid();

enum _Role { user, assistant, error }

class _Message {
  final _Role role;
  final String text;
  _Message(this.role, this.text);
}

class HistorialScreen extends StatefulWidget {
  const HistorialScreen({super.key});

  @override
  State<HistorialScreen> createState() => _HistorialScreenState();
}

class _HistorialScreenState extends State<HistorialScreen> {
  final _controller = TextEditingController();
  final _messages = <_Message>[];
  final _scrollController = ScrollController();
  bool _busy = false;

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _busy) return;
    _controller.clear();

    setState(() {
      _messages.add(_Message(_Role.user, text));
      _busy = true;
    });
    _scrollToEnd();

    final app = context.read<AppState>();
    final contract = app.contract;
    if (contract == null) {
      setState(() {
        _messages.add(_Message(_Role.error, 'Todavía no hay un contrato UAP descubierto. Conectate a un backend primero.'));
        _busy = false;
      });
      return;
    }

    try {
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
        // El LLM local puede fallar (modelo no cargado, respuesta no
        // parseable, etc): el parser determinista igual intenta resolver
        // la intención solo con el texto, sin depender del LLM.
        draft = null;
      }

      final parser = IntentParser(contract);
      final result = parser.parse(text, draft: draft);

      switch (result) {
        case ParsedInvocation(:final toolId, :final input):
          final tool = contract.toolsById[toolId]!;
          final entity = contract.manifest.entities.firstWhere((e) => e.key == tool.entityKey);
          final response = await app.uapClient!.invoke(toolId, input, clientRecordId: _uuid.v4());
          final phrase = phraseForResult(verb: tool.verb, entity: entity, result: response);
          setState(() => _messages.add(_Message(_Role.assistant, phrase)));
        case NeedsClarification(:final questionEs):
          setState(() => _messages.add(_Message(_Role.assistant, questionEs)));
        case Rejected(:final reasonEs):
          setState(() => _messages.add(_Message(_Role.error, 'No pude determinar una única acción: $reasonEs')));
      }
    } catch (e) {
      setState(() => _messages.add(_Message(_Role.error, phraseForBackendRejected(e.toString()))));
    } finally {
      setState(() => _busy = false);
      _scrollToEnd();
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final connection = context.watch<AppState>().connection;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Asistente'),
        actions: [
          IconButton(
            icon: const Icon(Icons.mic),
            tooltip: 'Modo Alexa (solo voz)',
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AlexaScreen())),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(28),
          child: _ConnectionBanner(state: connection?.state),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(12),
              itemCount: _messages.length,
              itemBuilder: (context, i) => _MessageBubble(message: _messages[i]),
            ),
          ),
          if (_busy) const LinearProgressIndicator(),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      decoration: const InputDecoration(hintText: 'Escribí un pedido...', border: OutlineInputBorder()),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  IconButton(icon: const Icon(Icons.send), onPressed: _busy ? null : _send),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final _Message message;
  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == _Role.user;
    final isError = message.role == _Role.error;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.all(12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isError
              ? Theme.of(context).colorScheme.errorContainer
              : (isUser ? Theme.of(context).colorScheme.primaryContainer : Theme.of(context).colorScheme.surfaceContainerHighest),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(message.text),
      ),
    );
  }
}

class _ConnectionBanner extends StatelessWidget {
  final UapConnectionState? state;
  const _ConnectionBanner({required this.state});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (state) {
      UapConnectionState.conectado => ('Conectado', Colors.green),
      UapConnectionState.sincronizando => ('Sincronizando...', Colors.blue),
      UapConnectionState.pendiente => ('Pendiente de sincronización', Colors.orange),
      UapConnectionState.desconectado => ('Sin conexión — usando datos locales', Colors.grey),
      UapConnectionState.conflicto => ('Conflicto con el servidor', Colors.red),
      UapConnectionState.fallido => ('No se pudo sincronizar', Colors.red),
      UapConnectionState.usandoDatosLocales => ('Usando datos locales', Colors.grey),
      null => ('Sin conexión configurada', Colors.grey),
    };
    return Container(
      width: double.infinity,
      color: color.withValues(alpha: 0.15),
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
      child: Text(label, style: TextStyle(color: color, fontSize: 12)),
    );
  }
}
