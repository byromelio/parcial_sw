import { WS_URL } from "../config";

let socket = null;     // 🔹 referencia al WebSocket activo
let listeners = {};    // 🔹 diccionario de eventos → callbacks registrados

// ====== CONECTAR AL SERVIDOR WS ======
export function connect(diagramId) {
  // Si ya hay un socket abierto, primero lo desconectamos
  if (socket) disconnect();

  // 🔌 Crear conexión WebSocket al backend
  socket = new WebSocket(`${WS_URL}/diagrams/${diagramId}/ws`);

  // Cuando se abre la conexión
  socket.onopen = () => {
    console.log("✅ Conectado a WS", diagramId);
  };

  // Cuando llega un mensaje desde el backend
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);  // 👈 parsea JSON entrante
    console.log("📩 Evento recibido:", msg);

    // Si hay listeners registrados para ese tipo de evento → ejecutarlos
    if (listeners[msg.event]) {
      listeners[msg.event].forEach(cb => cb(msg.data));
    }
  };

  // Cuando se cierra la conexión
  socket.onclose = () => {
    console.log("❌ WS cerrado");
  };
}

// ====== DESCONECTAR DEL SERVIDOR WS ======
export function disconnect() {
  if (socket) {
    socket.close();   // cerrar conexión activa
    socket = null;    // limpiar referencia
    listeners = {};   // limpiar todos los listeners registrados
  }
}

// ====== REGISTRAR EVENTOS ======
/**
 * Suscribe un callback a un tipo de evento recibido por WS.
 * @param {string} event - nombre del evento (ej. "class.created")
 * @param {function} callback - función que se ejecutará al recibir el evento
 */
export function onEvent(event, callback) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);
}
