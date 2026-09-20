# Contexto mobile — parcial_sw

## Estado real de compilación (verificado en esta sesión, contradice CONTEXTO_PROYECTO.md original)

El documento de la raíz decía explícitamente: "Nunca se compiló. No existe `mobile/android/`, no existe `mobile/ios/`, no hay `pubspec.lock`". Esto **ya no es cierto**:

- `mobile/android/` **existe**, con proyecto Gradle generado: `build.gradle.kts` (raíz y `app/`), `settings.gradle.kts`, `gradle.properties`, `gradlew`/`gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar`/`.properties`, `local.properties`, `AndroidManifest.xml` (`main`, `debug`, `profile`), `MainActivity.kt` (paquete `com.example.uml_collab_mobile`), recursos `mipmap-*`/`drawable*`, `GeneratedPluginRegistrant.java`.
- `mobile/pubspec.lock` **existe**.
- Artefactos de `flutter pub get`: `.dart_tool/package_config.json`, `.dart_tool/package_graph.json`, `.flutter-plugins-dependencies`.
- `mobile/ios/` **sigue sin existir** (no confirmado que se haya intentado generar).
- **No confirmado**: si el proyecto compila realmente (`flutter build`/`flutter run` no se ejecutaron en esta sesión). La existencia de `android/` y `pubspec.lock` indica que al menos se corrió `flutter create` y `flutter pub get`, pero no prueba un build exitoso.
- **No confirmado**: si `mobile/` está trackeado en git actualmente. El `git status` mostrado al inicio de esta sesión no lista ningún archivo dentro de `mobile/` como modificado o untracked, lo cual es ambiguo: puede significar que ya fue commiteado en un commit previo, o que sigue cubierto por un `.gitignore` (existe `mobile/.gitignore`, contenido no leído en este audit). Se recomienda correr `git status mobile/` y `git log -- mobile/` para confirmar antes de asumir cualquiera de las dos opciones.

## Arquitectura (según código, sin ejecutar)

Dart puro en `mobile/lib/`, 14 archivos aproximadamente. Estado global con `ChangeNotifier` (`app_state.dart`, provisto vía `provider`), sin un framework de estado más complejo (no hay Riverpod/Bloc).

## Pantallas (`mobile/lib/screens/`)

- `login_screen.dart`, `diagram_list_screen.dart`, `diagram_screen.dart`, `assistant_screen.dart`.

### `assistant_screen.dart` (detalle, confirmado por lectura completa)

Pantalla de asistente de IA **100% offline**. Flujo de arranque (`_prepare()`): verifica si el LLM y el modelo Vosk ya están descargados (`app.downloader.isLlmDownloaded()`/`isVoskDownloaded()`); si no, los descarga mostrando progreso (`_Stage.downloading`); carga ambos motores en memoria (`app.llm.load(llmPath)`, `app.speech.load(voskPath)`); pasa a `_Stage.ready`.

Dictado por voz: `_toggleListening()` llama a `app.speech.startListening(onPartial, onFinal)`. `onPartial` actualiza un texto parcial en pantalla (itálica, mientras la persona sigue hablando); `onFinal` corta la escucha y llama a `_sendCommand(text)` con la frase completa reconocida.

`_sendCommand(text)`: arma un snapshot JSON del diagrama actual (clases/atributos/métodos, vía `app.api.listClasses`), llama a `app.llm.resolveCommand(userText, diagramSnapshot)` (LLM local decide una `LlmToolCall`), y aplica el resultado con `_applyToolCall`, que soporta: `clarify`, `create_class`, `rename_class`, `delete_class`, `add_attribute`, `delete_attribute`, `add_method`, `delete_method`, `create_relation`, `delete_relation` — el mismo conjunto conceptual de tools que `ai_tools.py` en el backend web, pero resuelto localmente sin red.

**Esta implementación de voz es completamente independiente de la nueva `voice.py`/Gemini del backend web.** No comparten código, no comparten endpoint, no comparten motor de reconocimiento (Vosk offline vs. Gemini en la nube). Ambas conviven porque son features para dos plataformas distintas con requisitos distintos (mobile debe funcionar sin internet el día del examen).

## Servicios (`mobile/lib/services/`)

- `api_client.dart`: cliente HTTP contra el mismo backend FastAPI que usa la web (no leído en detalle en este audit).
- `auth_service.dart`: JWT en `SharedPreferences` (no leído en detalle).
- `realtime_service.dart`: cliente WebSocket, mismo protocolo que `backend/app/routers/realtime.py` (no leído en detalle, asumido por nombre y por `CONTEXTO_PROYECTO.md` previo — no reverificado línea por línea).
- `local_llm_service.dart`: LLM local (Qwen2.5-1.5B-Instruct, GGUF Q4_K_M) vía `llamadart`. Expone `resolveCommand(userText, diagramSnapshot)` (usado por `assistant_screen.dart`, confirmado).
- `speech_service.dart` (confirmado por lectura completa): wrapper sobre `vosk_flutter_2`. `load(modelPath)` carga el modelo Vosk una vez. `startListening({onPartial, onFinal})` escucha dos streams (`onPartial()`, `onResult()`) y extrae texto de un JSON crudo tipo `{"partial": "..."}`/`{"text": "..."}` con una regex simple (`_extractText`), descartando el valor especial `"nun"` que Vosk devuelve cuando no reconoció nada. `stopListening()`, `dispose()`.
- `model_downloader.dart`: descarga LLM (~1GB) y modelo Vosk (~50MB) la primera vez, no van empaquetados en el APK (no leído en detalle, confirmado por referencias en `assistant_screen.dart` y `README.md`).

## Modelos (`mobile/lib/models/diagram.dart`)

Espejo de los schemas Pydantic del backend (no leído en detalle en este audit).

## Navegación

No se confirmó un sistema de rutas nombradas — parece usar `Navigator` estándar push/pop (no reverificado en este audit puntual, heredado de la doc previa).

## Comunicación con el backend

REST vía `api_client.dart` + WebSocket vía `realtime_service.dart`, apuntando a `lib/config.dart` (default documentado en `mobile/README.md`: `http://10.0.2.2:8000`, dirección especial del emulador Android hacia el `localhost` de la PC; para dispositivo físico se recomienda cambiar a la IP de LAN o usar `adb reverse`).

## Almacenamiento local

`shared_preferences` para el JWT (`auth_service.dart`, no leído en detalle). Modelos de IA (LLM + Vosk) se guardan en una carpeta local del dispositivo, fuera del APK (`model_downloader.dart`).

## README de mobile (`mobile/README.md`, leído completo)

Documenta paso a paso: instalar Java 17 + Android SDK (command line tools) + Flutter, generar `android/` con `flutter create --platforms=android --org com.parcialsw --project-name uml_collab_mobile .`, agregar permisos `RECORD_AUDIO`/`INTERNET` al manifest, ajustar `minSdk=24` (requerido por `llamadart`), `flutter pub get`, y probar en un teléfono físico por USB (recomendado sobre emulador). Documenta también que la primera apertura del asistente descarga LLM (~1GB) y Vosk (~50MB).

**Nota de coherencia**: el README sigue redactado como guía de "pasos pendientes", pero el estado real del repo (sección de arriba) ya muestra `android/` generado y `pubspec.lock` presente — es decir, al menos los pasos 1 y 2 de esa guía ya se ejecutaron. El README no fue actualizado para reflejar ese avance (no se modifica en esta tarea, solo se señala).

## Funcionalidades implementadas (según código)

- Login, listado de diagramas, vista simplificada del diagrama (sin lienzo de posición libre, según diseño documentado previamente — no reverificado en este audit puntual).
- Asistente de IA por voz/texto 100% offline, con el mismo contrato de tools que el asistente web (confirmado en `assistant_screen.dart`).
- Colaboración vía el mismo WebSocket del backend (no reverificado en detalle).

## Estado actual (resumen)

Código fuente completo. `android/` generado y dependencias instaladas (`pubspec.lock`), lo cual es un avance real no reflejado en la documentación previa. Build/ejecución exitosa **no confirmada** en esta sesión. Estado de tracking en git **no confirmado** (ambiguo por el git status inicial).
