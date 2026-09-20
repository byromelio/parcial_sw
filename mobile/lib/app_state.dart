// lib/app_state.dart
//
// Estado global mínimo compartido entre pantallas: sesión del usuario y los
// servicios que se instancian una sola vez (API, IA local, voz). No guarda
// el diagrama actual completo -- eso vive en la pantalla del diagrama, que
// lo recarga vía ApiClient/RealtimeService.

import 'package:flutter/foundation.dart';
import 'services/auth_service.dart';
import 'services/api_client.dart';
import 'services/local_llm_service.dart';
import 'services/speech_service.dart';
import 'services/model_downloader.dart';

class AppState extends ChangeNotifier {
  final AuthService auth = AuthService();
  late final ApiClient api = ApiClient(auth);
  final LocalLlmService llm = LocalLlmService();
  final SpeechRecognitionService speech = SpeechRecognitionService();
  final ModelDownloader downloader = ModelDownloader();

  bool _ready = false;
  bool get ready => _ready;

  Future<void> bootstrap() async {
    await auth.loadFromDisk();
    _ready = true;
    notifyListeners();
  }

  bool get isLoggedIn => auth.token != null;

  Future<void> logout() async {
    await auth.signOut();
    notifyListeners();
  }
}
