// lib/services/model_downloader.dart
//
// El modelo GGUF del LLM (~1GB) y el modelo Vosk español (~50MB) NO viajan
// dentro del APK: son demasiado pesados para reinstalar la app seguido
// durante pruebas. Se descargan una sola vez a la carpeta de datos de la
// app (path_provider) y quedan ahí entre reinstalaciones del APK que no
// borren datos de la app (o se re-descargan si se limpiaron).

import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:archive/archive_io.dart';

class ModelDownloader {
  // Qwen2.5-1.5B-Instruct, cuantización Q4_K_M: buen balance para un
  // Snapdragon 685 sin NPU (~1GB, corre en CPU pura a unos pocos
  // tokens/segundo, suficiente para respuestas cortas de function-calling).
  static const llmModelUrl =
      'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf';
  static const llmModelFileName = 'qwen2.5-1.5b-instruct-q4_k_m.gguf';

  // Modelo Vosk español chico (~50MB), del catálogo oficial alphacephei.
  static const voskModelUrl = 'https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip';
  static const voskModelDirName = 'vosk-model-small-es-0.42';

  Future<Directory> _modelsDir() async {
    final base = await getApplicationSupportDirectory();
    final dir = Directory('${base.path}/models');
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  Future<String> llmModelPath() async => '${(await _modelsDir()).path}/$llmModelFileName';
  Future<String> voskModelPath() async => '${(await _modelsDir()).path}/$voskModelDirName';

  Future<bool> isLlmDownloaded() async => File(await llmModelPath()).exists();
  Future<bool> isVoskDownloaded() async => Directory(await voskModelPath()).exists();

  /// Descarga el GGUF con progreso (0.0 a 1.0). Cancela y borra el archivo
  /// parcial si algo falla a mitad de camino, para no dejar un .gguf
  /// corrupto que después falle al cargar sin explicación.
  Future<void> downloadLlm({required void Function(double progress) onProgress}) async {
    final path = await llmModelPath();
    final file = File(path);
    final tmpFile = File('$path.part');

    final request = http.Request('GET', Uri.parse(llmModelUrl));
    final response = await http.Client().send(request);
    if (response.statusCode != 200) {
      throw Exception('No se pudo descargar el modelo (HTTP ${response.statusCode})');
    }

    final total = response.contentLength ?? 0;
    var received = 0;
    final sink = tmpFile.openWrite();
    try {
      await for (final chunk in response.stream) {
        sink.add(chunk);
        received += chunk.length;
        if (total > 0) onProgress(received / total);
      }
      await sink.close();
      await tmpFile.rename(path);
    } catch (e) {
      await sink.close();
      if (await tmpFile.exists()) await tmpFile.delete();
      rethrow;
    }
    // ignore: unnecessary_statements
    file; // referenciado para claridad del path final
  }

  /// Descarga y descomprime el modelo Vosk (viene como .zip).
  Future<void> downloadVosk({required void Function(double progress) onProgress}) async {
    final modelsDir = await _modelsDir();
    final zipPath = '${modelsDir.path}/$voskModelDirName.zip';

    final request = http.Request('GET', Uri.parse(voskModelUrl));
    final response = await http.Client().send(request);
    if (response.statusCode != 200) {
      throw Exception('No se pudo descargar el modelo de voz (HTTP ${response.statusCode})');
    }

    final total = response.contentLength ?? 0;
    var received = 0;
    final sink = File(zipPath).openWrite();
    await for (final chunk in response.stream) {
      sink.add(chunk);
      received += chunk.length;
      if (total > 0) onProgress(received / total * 0.8); // 80% descarga, 20% descompresión
    }
    await sink.close();

    final bytes = await File(zipPath).readAsBytes();
    final archive = ZipDecoder().decodeBytes(bytes);
    for (final entry in archive) {
      final outPath = '${modelsDir.path}/${entry.name}';
      if (entry.isFile) {
        final outFile = File(outPath);
        await outFile.create(recursive: true);
        await outFile.writeAsBytes(entry.content as List<int>);
      } else {
        await Directory(outPath).create(recursive: true);
      }
    }
    onProgress(1.0);
    await File(zipPath).delete();
  }
}
