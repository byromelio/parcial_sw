// src/components/canvas/ClassCardShell.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SHEET } from "./Sheet";

/**
 * Shell de la tarjeta (drag/resize/selección/estilos)
 *
 * Props:
 *  - cls: { id, name, x_grid, y_grid, w_grid, h_grid, z_index }
 *  - selected?: boolean
 *  - onSelect?(id)
 *  - onDragEnd?(id, { x_grid, y_grid })
 *  - onResizeEnd?(id, { w_grid, h_grid })
 *  - minH?: number (default 4)
 *  - maxH?: number (default 32)
 *  - autoGrowHeight?: boolean (default true)
 *  - headerRight?: ReactNode   (ej. botón de pin)
 *  - children?: ReactNode      (cuerpo: detalles)
 */
export default function ClassCardShell({
  cls,
  selected = false,
  onSelect,
  onDragEnd,
  onResizeEnd,
  minH = 4,
  maxH = 32,
  autoGrowHeight = true,
  headerRight = null,
  children,
}) {
  const { CELL } = SHEET;

  // estado local pos/tamaño sincronizado con props
  const [pos, setPos] = useState({ x: cls.x_grid ?? 0, y: cls.y_grid ?? 0 });
  const [size, setSize] = useState({ w: cls.w_grid ?? 12, h: cls.h_grid ?? 6 });
  useEffect(() => { setPos({ x: cls.x_grid ?? 0, y: cls.y_grid ?? 0 }); }, [cls.x_grid, cls.y_grid]);
  useEffect(() => { setSize({ w: cls.w_grid ?? 12, h: cls.h_grid ?? 6 }); }, [cls.w_grid, cls.h_grid]);

  // drag/resize
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const start = useRef({ x: 0, y: 0, px: 0, py: 0, w: 0, h: 0 });

  const pxToGrid = (px) => Math.max(0, Math.round(px / CELL));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampSize = (v, min = 3) => Math.max(min, v);

  const onHeaderMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    setDragging(true);
    start.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, w: size.w, h: size.h };
    e.stopPropagation(); e.preventDefault();
  }, [pos, size]);

  const onHandleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    setResizing(true);
    start.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, w: size.w, h: size.h };
    e.stopPropagation(); e.preventDefault();
  }, [pos, size]);

  useEffect(() => {
    const onMove = (e) => {
      if (dragging) {
        const dx = e.clientX - start.current.x;
        const dy = e.clientY - start.current.y;
        const gx = pxToGrid(start.current.px * CELL + dx);
        const gy = pxToGrid(start.current.py * CELL + dy);
        setPos({ x: gx, y: gy });
      } else if (resizing) {
        const dx = e.clientX - start.current.x;
        const dy = e.clientY - start.current.y;
        const gw = clampSize(pxToGrid(start.current.w * CELL + dx));
        const gh = clamp(clampSize(pxToGrid(start.current.h * CELL + dy)), minH, maxH);
        setSize({ w: gw, h: gh });
      }
    };
    const onUp = () => {
      if (dragging) {
        setDragging(false);
        onDragEnd?.(cls.id, { x_grid: pos.x, y_grid: pos.y });
      } else if (resizing) {
        setResizing(false);
        onResizeEnd?.(cls.id, { w_grid: size.w, h_grid: size.h });
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, resizing, pos, size, onDragEnd, onResizeEnd, cls?.id, CELL, minH, maxH]);

  // Auto-alto: el hijo puede pedir cambiar h_grid pasando los píxeles necesarios
  const debouncedPersistRef = useRef(null);
  const requestHeightFromPx = useCallback((totalPx) => {
    if (!autoGrowHeight) return;
    const rows = clamp(Math.ceil(totalPx / CELL), minH, maxH);
    if (rows === size.h) return;
    setSize(s => ({ ...s, h: rows }));
    if (debouncedPersistRef.current) clearTimeout(debouncedPersistRef.current);
    debouncedPersistRef.current = setTimeout(() => {
      onResizeEnd?.(cls.id, { w_grid: size.w, h_grid: rows });
    }, 250);
  }, [autoGrowHeight, CELL, minH, maxH, onResizeEnd, cls.id, size.w, size.h]);

  // posiciones en px
  const left = (pos.x ?? 0) * CELL;
  const top = (pos.y ?? 0) * CELL;
  const width = (size.w ?? 12) * CELL;
  const height = (size.h ?? 6) * CELL;

  const containerStyle = useMemo(() => ({
    position: "absolute",
    left, top, width, height,
    background: selected ? "#122038" : "#0e1526",
    border: selected ? "2px solid #6ab0ff" : "1px solid #334",
    borderRadius: 8,
    color: "#eaeefb",
    boxShadow: selected ? "0 8px 24px rgba(0,80,255,.25)" : "0 6px 20px rgba(0,0,0,.25)",
    overflow: "hidden",
    zIndex: cls.z_index ?? 1,
    cursor: dragging ? "grabbing" : "default",
    transition: "box-shadow .15s, border-color .15s, background .15s",
  }), [left, top, width, height, selected, dragging, cls.z_index]);

  return (
    <div onMouseDown={() => onSelect?.(cls.id)} style={containerStyle}>
      {/* Header (drag + slot acciones) */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          padding: 8,
          fontWeight: 700,
          borderBottom: "1px solid #26314d",
          cursor: "grab",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
        title="Arrastra para mover"
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cls.name ?? cls.nombre ?? "Clase"}
        </span>
        <div onMouseDown={(e) => e.stopPropagation()}>
          {headerRight}
        </div>
      </div>

      {/* Cuerpo: lo rinde el padre */}
      <div style={{ padding: 8, fontSize: 12, lineHeight: 1.3, height: "auto", overflow: "hidden" }}>
        {typeof children === "function" ? children({ requestHeightFromPx }) : children}
      </div>

      {/* Handle de resize manual */}
      <div
        onMouseDown={onHandleMouseDown}
        style={{
          position: "absolute",
          right: 2, bottom: 2,
          width: 14, height: 14,
          border: "1px solid #445",
          borderRadius: 4,
          background: "rgba(255,255,255,.06)",
          cursor: "nwse-resize",
        }}
        title="Arrastra para redimensionar"
      />
    </div>
  );
}
