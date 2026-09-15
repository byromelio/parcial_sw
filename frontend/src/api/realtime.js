import { WS_URL } from "../config";

// Canal WebSocket del diagrama: por acá llegan los cambios que hacen los
// demás usuarios y también el progreso del asistente de IA.
//
// Los listeners viven aparte del socket a propósito: antes `connect()` los
// borraba a todos, así que cualquier componente que se suscribiera antes de
// que se abriera la conexión (por el orden en que React corre los efectos)
// se quedaba sin recibir nada.

let socket = null;
let currentDiagramId = null;
const listeners = new Map(); // event -> Set<callback>

function emit(event, data) {
  const subs = listeners.get(event);
  if (!subs) return;
  for (const cb of subs) {
    try {
      cb(data);
    } catch (err) {
      console.error(`[realtime] error en listener de "${event}":`, err);
    }
  }
}

export function connect(diagramId) {
  // Ya conectados a este mismo diagrama: no reabrir.
  if (socket && currentDiagramId === diagramId && socket.readyState <= WebSocket.OPEN) {
    return;
  }

  closeSocket();
  currentDiagramId = diagramId;
  socket = new WebSocket(`${WS_URL}/diagrams/${diagramId}/ws`);

  socket.onopen = () => console.log("[realtime] conectado al diagrama", diagramId);

  socket.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      console.warn("[realtime] mensaje no es JSON:", event.data);
      return;
    }
    emit(msg.event, msg.data);
  };

  socket.onclose = () => console.log("[realtime] conexión cerrada");
  socket.onerror = (e) => console.error("[realtime] error de conexión:", e);
}

function closeSocket() {
  if (!socket) return;
  socket.onclose = null;
  socket.close();
  socket = null;
}

export function disconnect() {
  closeSocket();
  currentDiagramId = null;
}

/**
 * Suscribe un callback a un evento del diagrama.
 * @returns {() => void} función para darse de baja.
 */
export function onEvent(event, callback) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(callback);
  return () => {
    listeners.get(event)?.delete(callback);
  };
}
