# UML Collab Mobile

App Flutter con el mismo backend FastAPI del editor web, más un asistente
de edición por voz o texto que corre **100% offline** en el teléfono:
reconocimiento de voz con Vosk y un LLM chico (Qwen2.5-1.5B-Instruct
cuantizado) corriendo con llama.cpp vía `llamadart`.

## 1. Instalar herramientas (una vez)

1. Java 17 (Temurin).
2. Android SDK, solo *command line tools*:
   - Descargar "Command line tools only" desde https://developer.android.com/studio#command-tools
   - Descomprimir en, por ejemplo, `C:\Android\cmdline-tools\latest\`
   - Variables de entorno: `ANDROID_HOME=C:\Android`, y agregar al `PATH`:
     `%ANDROID_HOME%\cmdline-tools\latest\bin` y `%ANDROID_HOME%\platform-tools`
   - `sdkmanager --licenses`
   - `sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"`
3. Flutter SDK: https://docs.flutter.dev/get-started/install/windows
4. Verificar todo con:

```bash
flutter doctor
```

## 2. Generar el proyecto Android (una vez)

Este repo trae solo el código Dart (`lib/`) y `pubspec.yaml`. Falta la carpeta
`android/` con el proyecto Gradle, que Flutter genera automáticamente:

```bash
cd mobile
flutter create --platforms=android --org com.parcialsw --project-name uml_collab_mobile .
```

Esto NO pisa `lib/` ni `pubspec.yaml` (ya existen), solo agrega `android/`.

## 3. Ajustes en `android/app/src/main/AndroidManifest.xml`

Agregar el permiso de micrófono (necesario para Vosk) dentro de `<manifest>`,
antes de `<application>`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
```

## 4. Ajustar `minSdkVersion`

En `android/app/build.gradle` (o `build.gradle.kts`), dentro de `defaultConfig`,
asegurar `minSdk = 24` (lo pide `llamadart` para el runtime nativo de
llama.cpp; el default de Flutter ya suele ser suficiente, pero conviene
confirmarlo):

```gradle
defaultConfig {
    minSdkVersion 24
    ...
}
```

## 5. Instalar dependencias

```bash
flutter pub get
```

## 6. Probar en el teléfono físico (recomendado, en vez de emulador)

1. Activar "Opciones de desarrollador" y "Depuración USB" en el Xiaomi.
2. Conectar por USB y confirmar el diálogo de autorización en el teléfono.
3. Verificar que aparece:

```bash
flutter devices
```

4. Instalar y correr:

```bash
flutter run
```

Cada `flutter run` reinstala el APK actualizado en el teléfono conectado.

## 7. Backend

Por defecto la app apunta a `http://10.0.2.2:8000` (`lib/config.dart`), que
es la dirección especial del emulador Android hacia el `localhost` de la PC.
Para un teléfono físico por USB, dos opciones:

- **Más simple:** cambiar `apiBaseUrl` en `lib/config.dart` por la IP local
  de la PC en la red WiFi (ej. `http://192.168.1.50:8000`), con el teléfono
  en la misma red.
- **Alternativa por cable:** `adb reverse tcp:8000 tcp:8000` y dejar
  `http://localhost:8000` (redirige el puerto del teléfono al de la PC).

## 8. Primera apertura del asistente IA

La primera vez que se abre la pantalla del asistente, la app descarga:

- El modelo LLM (Qwen2.5-1.5B-Instruct-GGUF Q4_K_M, ~1 GB)
- El modelo de voz en español de Vosk (~50 MB)

a una carpeta local del dispositivo (no van dentro del APK). Requiere
conexión a internet solo esa primera vez; después el asistente funciona
sin red.
