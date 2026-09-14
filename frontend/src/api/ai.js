import api from "./client";

/**
 * Envia un comando en lenguaje natural (texto, o voz ya transcripta) para
 * que el asistente de IA edite el diagrama. El diagrama se actualiza solo
 * via el WebSocket existente (mismo canal que usan las ediciones manuales),
 * asi que esta funcion no necesita devolver el diagrama actualizado.
 */
export const sendAiCommand = (diagramId, text) => {
  return api
    .post(`/diagrams/${diagramId}/ai/command`, { text })
    .then((r) => r.data)
    .catch((err) => {
      console.error("❌ [sendAiCommand] error:", err?.response?.data || err);
      throw err;
    });
};
