// src/components/canvas/ClassDetails.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { listAttributes, listMethods } from "../../api/classes";

/**
 * Detalles de la clase (lazy-load + cache local)
 *
 * Props:
 *  - classId: UUID
 *  - className?: string
 *  - visible: boolean              -> si debe renderizar listas
 *  - pinned: boolean               -> fijar abierto
 *  - onTogglePin?(): void          -> click en botón
 *  - onHeightsChange?(totalPx):    -> para autoGrow del shell
 */
export default function ClassDetails({
  classId,
  className,
  visible,
  pinned,
  onTogglePin,
  onHeightsChange,
}) {
  const [attrs, setAttrs] = useState(null);
  const [meths, setMeths] = useState(null);
  const [loading, setLoading] = useState(false);

  const headerRef = useRef(null);
  const bodyRef = useRef(null);

  // Lazy-load una sola vez cuando necesitemos mostrar detalles.
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!visible) return;
      if (attrs !== null && meths !== null) return;
      setLoading(true);
      try {
        const [a, m] = await Promise.all([listAttributes(classId), listMethods(classId)]);
        if (!alive) return;
        setAttrs(a || []);
        setMeths(m || []);
      } catch {
        if (!alive) return;
        setAttrs([]); setMeths([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [visible, classId]); // cachea entre aperturas

  // Avisar cuánto alto necesitamos (para autoGrow del shell)
  useEffect(() => {
    if (!visible || !onHeightsChange) return;
    const headerH = headerRef.current?.offsetHeight ?? 0;
    const bodyH = bodyRef.current?.scrollHeight ?? 0;
    const total = headerH + bodyH + 16; // respiración
    onHeightsChange(total);
  }, [visible, attrs, meths, onHeightsChange]);

  const counts = useMemo(() => ({
    attrs: Array.isArray(attrs) ? attrs.length : null,
    meths: Array.isArray(meths) ? meths.length : null,
  }), [attrs, meths]);

  return (
    <>
      {/* Encabezado interno: pin + (si no visible, mostrar contadores) */}
      <div ref={headerRef} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <div style={{ fontWeight: 600, opacity: .9 }}>{className || "Clase"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!visible && (counts.attrs !== null || counts.meths !== null) && (
            <span style={{ fontSize: 11, opacity: .85 }}>
              {(counts.attrs ?? 0)} attrs · {(counts.meths ?? 0)} métodos
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }}
            title={pinned ? "Desfijar detalles" : "Fijar detalles"}
            style={{
              border: "1px solid #334",
              background: pinned ? "#334" : "transparent",
              color: "inherit",
              borderRadius: 6,
              padding: "2px 6px",
              cursor: "pointer",
            }}
          >
            {pinned ? "📌" : "📍"}
          </button>
        </div>
      </div>

      {/* Cuerpo */}
      <div ref={bodyRef}>
        {visible ? (
          loading ? (
            <div style={{ opacity: .8 }}>Cargando detalles…</div>
          ) : (
            <>
              {/* Atributos */}
              <div style={{ marginBottom: 6, fontWeight: 600, opacity: .9 }}>Atributos</div>
              {!attrs || attrs.length === 0 ? (
                <div style={{ opacity: .7, marginBottom: 8 }}>—</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16, marginBottom: 8 }}>
                  {attrs.map(a => (
                    <li key={a.id} style={{ margin: "2px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ opacity: .95 }}>{a.name ?? a.nombre}</span>
                      <span style={{ opacity: .7 }}> : {a.type ?? a.tipo ?? "string"}</span>
                      {a.required ? <span style={{ opacity: .9, marginLeft: 6 }}>*</span> : null}
                    </li>
                  ))}
                </ul>
              )}

              {/* Métodos */}
              <div style={{ marginBottom: 6, fontWeight: 600, opacity: .9 }}>Métodos</div>
              {!meths || meths.length === 0 ? (
                <div style={{ opacity: .7 }}>—</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {meths.map(m => (
                    <li key={m.id} style={{ margin: "2px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ opacity: .95 }}>{m.name}</span>
                      <span style={{ opacity: .7 }}> : {m.return_type ?? "void"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        ) : (
          <div style={{ opacity: .75 }}>Selecciona o fija para ver detalles.</div>
        )}
      </div>
    </>
  );
}
