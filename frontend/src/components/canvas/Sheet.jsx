 
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
      const next = { ...c, z };
      onCameraChange?.(next);
      return next;
    });
  }, [onCameraChange]);

  const onMouseDown = useCallback((e) => {
    if (e.button !== 1 && !(e.button === 0 && e.ctrlKey)) return;
    panning.current = true;
    last.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!panning.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setCam((c) => {
      const next = { ...c, x: c.x + dx, y: c.y + dy };
      onCameraChange?.(next);
      return next;
    });
  }, [onCameraChange]);

  const onMouseUp = useCallback(() => { panning.current = false; }, []);

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
        background: "#0b1020",
        userSelect: panning.current ? "none" : undefined,
      }}
      title="Pan: rueda o Ctrl+arrastrar | Zoom: rueda | Click: acción del padre"
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
            "linear-gradient(#182032 1px, transparent 1px), linear-gradient(90deg, #182032 1px, transparent 1px)",
          backgroundSize: `${CELL}px ${CELL}px`,
          border: "1px solid #26314d",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
