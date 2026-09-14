// frontend/src/components/panels/AiAssistantPanel.jsx
//
// Panel flotante del asistente de IA: el usuario escribe (o dicta por voz)
// una instruccion puntual ("creá la clase Cliente", "agregale un atributo
// email a Cliente") y el backend la traduce en llamadas a la API existente.
// El diagrama se refresca solo via el WebSocket ya conectado (useDiagram /
// useClassesAndDetails / useRelations), asi que este panel no toca el
// estado del canvas directamente.

import { useRef, useState } from "react";
import { sendAiCommand } from "../../api/ai";

const SpeechRecognitionApi =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export default function AiAssistantPanel({ diagramId }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [log, setLog] = useState([]); // [{role: 'user'|'assistant'|'error', text}]
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const send = async (commandText) => {
    const value = (commandText ?? text).trim();
    if (!value || sending) return;

    setLog((prev) => [...prev, { role: "user", text: value }]);
    setText("");
    setSending(true);

    try {
      const res = await sendAiCommand(diagramId, value);
      setLog((prev) => [...prev, { role: "assistant", text: res.reply }]);
    } catch (err) {
      const detail = err?.response?.data?.detail || "No se pudo procesar el comando.";
      setLog((prev) => [...prev, { role: "error", text: detail }]);
    } finally {
      setSending(false);
    }
  };

  const toggleVoice = () => {
    if (!SpeechRecognitionApi) {
      alert("Este navegador no soporta reconocimiento de voz (probá con Chrome).");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const rec = new SpeechRecognitionApi();
    rec.lang = "es-ES";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript;
      if (transcript) send(transcript);
    };

    recognitionRef.current = rec;
    rec.start();
  };

  return (
    <div style={{ position: "absolute", right: 16, bottom: 16, zIndex: 20 }}>
      {open && (
        <div
          style={{
            width: 340,
            height: 420,
            marginBottom: 8,
            display: "flex",
            flexDirection: "column",
            background: "var(--panel-bg, #131a2e)",
            color: "var(--text, #eaeefb)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              fontWeight: 600,
              borderBottom: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            Asistente del diagrama
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {log.length === 0 && (
              <div style={{ opacity: 0.6, fontSize: 13 }}>
                Pedime ediciones puntuales, ej: "creá una clase Cliente", "agregale un
                atributo email de tipo String a Cliente", "creá una relación de uno a
                muchos entre Cliente y Pedido".
              </div>
            )}
            {log.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                  background:
                    m.role === "user"
                      ? "var(--accent, #3b82f6)"
                      : m.role === "error"
                      ? "#7f1d1d"
                      : "rgba(255,255,255,0.08)",
                }}
              >
                {m.text}
              </div>
            ))}
            {sending && <div style={{ opacity: 0.6, fontSize: 13 }}>Pensando…</div>}
          </div>

          <div style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Escribí un comando…"
              style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "inherit" }}
            />
            <button
              onClick={toggleVoice}
              title="Dictar por voz"
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.2)",
                background: listening ? "#dc2626" : "transparent",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              🎤
            </button>
            <button
              onClick={() => send()}
              disabled={sending}
              style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "var(--accent, #3b82f6)", color: "#fff", cursor: "pointer" }}
            >
              Enviar
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "none",
          background: "var(--accent, #3b82f6)",
          color: "#fff",
          fontSize: 22,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        }}
        title="Asistente de IA"
      >
        {open ? "✕" : "💬"}
      </button>
    </div>
  );
}
