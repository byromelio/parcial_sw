import { useCallback, useEffect, useRef } from "react";

export default function useAutoGrow({
  enabled,
  headerRef,
  bodyRef,
  CELL,
  minH,
  maxH,
  size,
  setSize,
  onResizeEnd,
  clsId,
}) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const debouncedPersistRef = useRef(null);

  const persistResizeDebounced = useCallback((newH) => {
    if (debouncedPersistRef.current) clearTimeout(debouncedPersistRef.current);
    debouncedPersistRef.current = setTimeout(() => {
      onResizeEnd?.(clsId, { w_grid: size.w, h_grid: newH });
    }, 250);
  }, [onResizeEnd, clsId, size.w]);

  useEffect(() => {
    if (!enabled) return;
    const headerH = headerRef.current?.offsetHeight ?? 0;
    const bodyH = bodyRef.current?.scrollHeight ?? 0;
    const totalPx = headerH + bodyH + 16;
    const neededRows = clamp(Math.ceil(totalPx / CELL), minH, maxH);
    if (neededRows !== size.h) {
      setSize((s) => ({ ...s, h: neededRows }));
      persistResizeDebounced(neededRows);
    }
  }, [enabled, headerRef, bodyRef, CELL, minH, maxH, size.h, setSize, persistResizeDebounced]);
}
