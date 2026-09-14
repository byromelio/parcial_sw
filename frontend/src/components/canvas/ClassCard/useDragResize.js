import { useCallback, useEffect, useRef, useState } from "react";

export default function useDragResize({ cls, minH, maxH, CELL, onDragEnd, onResizeEnd }) {
  const [pos, setPos] = useState({ x: cls.x_grid ?? 0, y: cls.y_grid ?? 0 });
  const [size, setSize] = useState({ w: cls.w_grid ?? 12, h: cls.h_grid ?? 6 });

  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const start = useRef({ x: 0, y: 0, px: 0, py: 0, w: 0, h: 0 });

  // pin + hover (sin cambios de lógica)
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => { setPos({ x: cls.x_grid ?? 0, y: cls.y_grid ?? 0 }); }, [cls.x_grid, cls.y_grid]);
  useEffect(() => { setSize({ w: cls.w_grid ?? 12, h: cls.h_grid ?? 6 }); }, [cls.w_grid, cls.h_grid]);

  const pxToGrid = (px) => Math.max(0, Math.round(px / CELL));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampSize = (v, min = 3) => Math.max(min, v);

  const onHeaderMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    setDragging(true);
    start.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, w: size.w, h: size.h };
    e.stopPropagation();
    e.preventDefault();
  }, [pos, size]);

  const onHandleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    setResizing(true);
    start.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, w: size.w, h: size.h };
    e.stopPropagation();
    e.preventDefault();
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

  return {
    pos, size, setSize,
    dragging,
    onHeaderMouseDown,
    onHandleMouseDown,
    pinned, setPinned,
    hover, setHover,
  };
}
