 
import React, { useCallback, useEffect, useRef, useState } from "react";

export const SHEET = { COLS: 96, ROWS: 64, CELL: 16 };

export default function Sheet({ children, onCanvasClick, onCameraChange }) {
  const { COLS, ROWS, CELL } = SHEET;
  const ref = useRef(null);
  const [cam, setCam] = useState(() => ({ x: 0, y: 0, z: 1 }));
  const panning = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta = Math.sign(e.deltaY) * 0.1;
    setCam((c) => {
      const z = Math.min(1.5, Math.max(0.5, c.z - delta)); // clamp
      return { ...c, z };
    });
  }, []);

  const moved = useRef(false);

  const onMouseDown = useCallback((e) => {
    // Botón central, Ctrl+izquierdo, o izquierdo sobre espacio vacío (no
    // sobre una clase u otro elemento interactivo) -- igual que draw.io:
    // mantener click en la pizarra y arrastrar mueve la vista.
    const onEmptySpace = e.target === e.currentTarget || e.target === ref.current?.firstElementChild;
    if (e.button !== 1 && !(e.button === 0 && (e.ctrlKey || onEmptySpace))) return;
    panning.current = true;
    moved.current = false;
    last.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!panning.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    setCam((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
  }, []);

  const onMouseUp = useCallback(() => { panning.current = false; }, []);

  // Avisar al padre después del commit, nunca desde dentro del updater de
  // setCam: llamar un setState ajeno mientras React todavía está
  // resolviendo el de este componente dispara "Cannot update a component
  // while rendering a different component".
  useEffect(() => {
    onCameraChange?.(cam);
  }, [cam, onCameraChange]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseDown, onMouseMove, onMouseUp]);

  const handleClick = useCallback((e) => {
    if (!onCanvasClick) return;
    if (moved.current) { moved.current = false; return; }
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const worldPxX = (localX - cam.x) / cam.z;
    const worldPxY = (localY - cam.y) / cam.z;
    const x_grid = Math.max(0, Math.round(worldPxX / CELL));
    const y_grid = Math.max(0, Math.round(worldPxY / CELL));
    onCanvasClick({ x_grid, y_grid });
  }, [onCanvasClick, cam.x, cam.y, cam.z, CELL]);

  return (
    <div
      ref={ref}
      onClick={handleClick}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "var(--bg)",
        userSelect: panning.current ? "none" : undefined,
        cursor: panning.current ? "grabbing" : "grab",
      }}
      title="Pan: arrastrá el espacio vacío, rueda o Ctrl+arrastrar | Zoom: rueda | Click: acción del padre"
    >
      <div
        style={{
          position: "absolute",
          left: cam.x,
          top: cam.y,
          transform: `scale(${cam.z})`,
          transformOrigin: "0 0",
          width: COLS * CELL,
          height: ROWS * CELL,
          background:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: `${CELL}px ${CELL}px`,
          backgroundColor: "var(--surface-1)",
          border: "1px solid var(--border-strong)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
