# Estado actual — parcial_sw

**Fecha de actualización**: 2026-09-20.

## Último trabajo realizado (según `git status`/`git diff` visibles al momento de este audit)

Cambios sin commitear en el working tree, rama `main`:
- `M backend/app/main.py` — registra el nuevo router `voice`.
- `M frontend/src/components/panels/AiAssistantPanel.jsx` — reemplaza la Web Speech API por grabación + transcripción backend.
- `?? backend/app/routers/voice.py` (nuevo) — endpoint `POST /voice/transcribe`.
- `?? backend/app/schemas/voice.py` (nuevo) — `VoiceTranscribeResult`.
- `?? backend/app/services/voice_transcribe.py` (nuevo) — transcripción de audio vía Gemini.
- `?? frontend/src/api/voice.js` (nuevo) — cliente HTTP del endpoint de voz.

Esto constituye una funcionalidad completa y coherente de "dictado por voz para el asistente de IA del editor web", con el backend registrado en `main.py` y el frontend consumiéndolo — confirmado por lectura de código, no por ejecución.

Commits recientes en el historial (`git log`, previos a estos cambios sin commitear):
```
12bacb0 docs: add project context, architecture and session-start guides
8557157 feat(mobile): scaffold Flutter app source and generate android/ for first build
fa9ebb8 feat(backend): add Postman collection and OpenAPI-to-Postman script
66d415f feat(infra): add Docker Compose for the diagramador and exporter Dockerfile
55a7124 chore: ignore local backups and tool cache directories
```
El commit `8557157` ("generate android/ for first build") es consistente con lo verificado en `CONTEXTO_MOBILE.md`: `mobile/android/` y `pubspec.lock` ya existen en el repo, contradiciendo al `CONTEXTO_PROYECTO.md` original que decía que mobile nunca se había compilado ni tenía `android/`.

## Funcionalidades terminadas (confirmado por lectura de código)

- CRUD de diagramas, clases, atributos, métodos, relaciones (backend + frontend).
- Colaboración en tiempo real vía WebSocket (locks por clase, cursores en vivo).
- Login con JWT.
- Asistente de IA por texto (Gemini, contrato de tools fijo).
- **Asistente de IA por voz, web (nuevo)**: grabación en el navegador → `POST /voice/transcribe` → Gemini transcribe → texto entra al flujo normal de `POST /diagrams/{id}/ai/command`. Router registrado en `main.py`. No probado en ejecución en esta sesión.
- Importar diagrama desde foto (Gemini Vision) con vista previa editable.
- Exportar/importar XMI 2.1.
- Generación de backend Spring Boot.
- Conversión a clase de asociación (UML 2.5).
- Asistente de IA por voz/texto 100% offline en mobile (Vosk + LLM local vía `llamadart`) — independiente del punto de voz web.
- Mobile: `android/` generado, `pubspec.lock` presente (avance real no documentado previamente).

## Funcionalidades en desarrollo / no confirmadas

- Funcionamiento en ejecución del endpoint `/voice/transcribe` (depende de `GEMINI_API_KEY` válida en `backend/.env`, contenido no leído en este audit).
- Compilación real de la app mobile (`flutter run`/`build` no ejecutado en esta sesión, pese a que `android/` y `pubspec.lock` ya existen).
- Estado de tracking en git de `mobile/` (ambiguo: no aparece en el `git status` inicial, no se determinó si es porque ya está commiteado o porque sigue en `.gitignore`).

## Problemas pendientes

- `POST /diagrams/{id}/export-download` no exige autenticación (`get_current_user`) ni valida propiedad del diagrama — cualquiera con el UUID puede exportar. Hallazgo de este audit, no documentado previamente. No corregido (fuera de alcance de esta tarea).
- Docstring desactualizado en `backend/app/services/ai_assistant.py`: sigue diciendo "la voz se transcribe en el cliente (Web Speech API)", lo cual ya no es así tras el cambio en `AiAssistantPanel.jsx`.
- `mobile/README.md` sigue redactado como guía de "pasos pendientes" (generar `android/`, etc.) pese a que esos pasos ya se ejecutaron según el estado real del repo.
- `frontend/README.md` es el boilerplate default de Vite, no documenta el proyecto.
- No hay endpoint de sign-up activo, pese a existir `SignUpIn`.
- No hay refresh token implementado, pese a existir `REFRESH_EXPIRE_DAYS` en la configuración.
- Inconsistencia de nombres de campo español/inglés entre distintos endpoints (ver `CONTRATOS_API.md`).
- `clase.nombre` no tiene unique constraint a nivel de base de datos por diagrama (solo se valida en el router) — a diferencia de `atributo`/`metodo`, que sí la tienen en el esquema SQL.

## Próximas tareas sugeridas (no ejecutadas en este audit, solo listadas)

1. Levantar el backend con Docker y probar `/voice/transcribe` de punta a punta (grabar audio real desde el navegador).
2. Confirmar si `GEMINI_API_KEY` está seteada y es válida en `backend/.env`.
3. Corregir el docstring desactualizado de `ai_assistant.py` sobre dónde se transcribe la voz.
4. Confirmar si `mobile/` está trackeado en git; si no, decidir si conviene agregarlo ahora que ya avanzó (`android/`, `pubspec.lock`).
5. Intentar un build real de mobile (`flutter run`) para confirmar que compila.
6. Decidir si se agrega autenticación a `POST /diagrams/{id}/export-download`.
7. Actualizar `mobile/README.md` y `frontend/README.md` para reflejar el estado real.
