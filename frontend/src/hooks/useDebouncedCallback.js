// src/hooks/useDebouncedCallback.js
import { useRef } from "react";

export default function useDebouncedCallback(cb, delay = 600) {
  // 🔹 useRef: guarda un valor mutable (no se reinicia en cada render).
  // En este caso, se usa para guardar el id del timer.
  const t = useRef(null);

  // 🔹 Devuelve una función "envuelta" que aplica debounce
  return (...args) => {
    // Si ya había un timer activo → lo cancela
    if (t.current) clearTimeout(t.current);

    // Crea un nuevo timer que ejecutará el callback después del delay
    t.current = setTimeout(() => cb(...args), delay);
  };
}
