// src/components/panels/RelationInspector.jsx
//
// Panel derecho cuando hay una relación seleccionada. Se mantuvo la lógica
// de guardado (fullUpdate manda siempre el objeto completo porque el PATCH
// del backend interpreta los campos ausentes); lo que se rehízo es la
// presentación: antes los cuatro campos de multiplicidad eran cajas sueltas
// sin ninguna etiqueta y no se entendía cuál era cuál.

import { useState, useEffect } from "react";
import Icon from "../common/Icon";

function useDebouncedCallback(callback, delay) {
  const [timeoutId, setTimeoutId] = useState(null);
  return function debounced(...args) {
    if (timeoutId) clearTimeout(timeoutId);
    const id = setTimeout(() => callback(...args), delay);
    setTimeoutId(id);
  };
}

const TIPOS = [
  { v: "ASSOCIATION", label: "Asociación", ayuda: "Se relacionan, pero cada una existe por su cuenta." },
  { v: "AGGREGATION", label: "Agregación", ayuda: "Una agrupa a la otra, que igual sobrevive sin ella." },
  { v: "COMPOSITION", label: "Composición", ayuda: "Una contiene a la otra; sin la primera, la otra no existe." },
  { v: "INHERITANCE", label: "Herencia", ayuda: "El destino es un tipo especializado del origen." },
  { v: "DEPENDENCY", label: "Dependencia", ayuda: "El origen usa al destino de forma puntual." },
];

const ANCHORS = [
  { v: "left", label: "Izquierda" },
  { v: "right", label: "Derecha" },
  { v: "top", label: "Arriba" },
  { v: "bottom", label: "Abajo" },
];

/** Vista previa en miniatura de cómo se ve cada tipo de relación en el
 * diagrama: la misma notación UML que dibuja ConnectionLayer, a escala
 * chica, para que elegir el tipo no dependa de recordar qué es cada uno. */
function RelationTypePreview({ type }) {
  const color = "var(--accent)";
  const common = { stroke: color, strokeWidth: 1.8, strokeLinecap: "round" };
  let marker = null;
  let dashed = false;

  switch (type) {
    case "INHERITANCE":
      marker = (
        <path d="M 44 8 L 30 4 L 44 0 z" fill="var(--surface-1)" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      );
      break;
    case "AGGREGATION":
      marker = (
        <path d="M 44 8 L 34 4 L 44 0 L 54 4 z" fill="var(--surface-1)" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      );
      break;
    case "COMPOSITION":
      marker = (
        <path d="M 44 8 L 34 4 L 44 0 L 54 4 z" fill={color} />
      );
      break;
    case "DEPENDENCY":
      dashed = true;
      marker = <path d="M 4 4 L 14 0 L 14 8 z" fill={color} />;
      break;
    default: // ASSOCIATION
      marker = null;
  }

  return (
    <svg viewBox="0 0 60 8" width="60" height="8" style={{ flexShrink: 0 }}>
      <line x1="2" y1="4" x2="58" y2="4" {...common} strokeDasharray={dashed ? "4,3" : undefined} />
      {marker}
    </svg>
  );
}

export default function RelationInspector({ relation, onUpdate, onDelete }) {
  const [localLabel, setLocalLabel] = useState(relation?.label ?? "");
  const [localMultOrigenMin, setLocalMultOrigenMin] = useState(relation?.src_mult_min ?? "");
  const [localMultOrigenMax, setLocalMultOrigenMax] = useState(
    relation?.src_mult_max === null ? "*" : relation?.src_mult_max ?? ""
  );
  const [localMultDestinoMin, setLocalMultDestinoMin] = useState(relation?.dst_mult_min ?? "");
  const [localMultDestinoMax, setLocalMultDestinoMax] = useState(
    relation?.dst_mult_max === null ? "*" : relation?.dst_mult_max ?? ""
  );

  useEffect(() => {
    if (!relation) return;
    setLocalLabel(relation.label ?? "");
    setLocalMultOrigenMin(relation.src_mult_min ?? "");
    setLocalMultOrigenMax(relation.src_mult_max === null ? "*" : relation.src_mult_max);
    setLocalMultDestinoMin(relation.dst_mult_min ?? "");
    setLocalMultDestinoMax(relation.dst_mult_max === null ? "*" : relation.dst_mult_max);
  }, [
    relation?.id,
    relation?.label,
    relation?.src_mult_min,
    relation?.src_mult_max,
    relation?.dst_mult_min,
    relation?.dst_mult_max,
  ]);

  const asideStyle = {
    width: "var(--inspector-w)",
    borderLeft: "1px solid var(--border)",
    background: "var(--surface-1)",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    zIndex: "var(--z-chrome)",
  };

  if (!relation) {
    return (
      <aside style={asideStyle}>
        <div className="text-muted" style={{ margin: "auto", fontSize: 13 }}>
          Seleccioná una relación para editarla.
        </div>
      </aside>
    );
  }

  const fullUpdate = (patch) => {
    const body = {
      type: patch.type ?? relation.type,
      label: patch.label ?? localLabel ?? relation.label ?? "",
      src_anchor: patch.src_anchor ?? relation.src_anchor ?? "right",
      dst_anchor: patch.dst_anchor ?? relation.dst_anchor ?? "left",
      src_offset: patch.src_offset ?? relation.src_offset ?? 0,
      dst_offset: patch.dst_offset ?? relation.dst_offset ?? 0,
      src_lane: patch.src_lane ?? relation.src_lane ?? 0,
      dst_lane: patch.dst_lane ?? relation.dst_lane ?? 0,
      src_mult_min: patch.src_mult_min ?? (localMultOrigenMin === "" ? null : Number(localMultOrigenMin)),
      src_mult_max: patch.src_mult_max ?? (localMultOrigenMax === "*" ? null : Number(localMultOrigenMax)),
      dst_mult_min: patch.dst_mult_min ?? (localMultDestinoMin === "" ? null : Number(localMultDestinoMin)),
      dst_mult_max: patch.dst_mult_max ?? (localMultDestinoMax === "*" ? null : Number(localMultDestinoMax)),
    };
    onUpdate(body);
  };

  const debouncedUpdate = useDebouncedCallback((val) => fullUpdate({ label: val }), 400);

  const tipoActual = TIPOS.find((t) => t.v === relation.type);
  const esHerenciaODependencia = ["INHERITANCE", "DEPENDENCY"].includes(relation.type);

  return (
    <aside style={asideStyle}>
      {/* ---------- Encabezado ---------- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-2)",
          padding: "var(--sp-4)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Icon name="relation" size={15} style={{ color: "var(--accent)" }} />
        <strong style={{ fontSize: 13, flex: 1 }}>Relación</strong>
        {tipoActual && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px var(--sp-2)",
              borderRadius: 999,
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            {tipoActual.label}
          </span>
        )}
        <button className="btn btn-danger-ghost btn-sm" onClick={onDelete} title="Eliminar esta relación">
          <Icon name="trash" size={14} />
          Eliminar
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, padding: "var(--sp-4)", display: "grid", gap: "var(--sp-5)", alignContent: "start" }}>
        {/* Quiénes se conectan */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--sp-3)",
            padding: "var(--sp-4) var(--sp-3)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            fontSize: 13,
          }}
        >
          <span
            style={{
              padding: "var(--sp-1) var(--sp-2)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-3)",
              fontWeight: 600,
            }}
          >
            {relation.origen_nombre}
          </span>
          <RelationTypePreview type={relation.type} />
          <span
            style={{
              padding: "var(--sp-1) var(--sp-2)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-3)",
              fontWeight: 600,
            }}
          >
            {relation.destino_nombre}
          </span>
        </div>

        {/* Tipo */}
        <div className="field">
          <label className="label">Tipo de relación</label>
          <select className="select" value={relation.type} onChange={(e) => fullUpdate({ type: e.target.value })}>
            {TIPOS.map((t) => (
              <option key={t.v} value={t.v}>{t.label}</option>
            ))}
          </select>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-3)",
              padding: "var(--sp-2) var(--sp-3)",
              borderRadius: "var(--radius)",
              background: "var(--surface-2)",
            }}
          >
            <RelationTypePreview type={relation.type} />
            {tipoActual && (
              <div className="text-subtle" style={{ fontSize: 12, flex: 1 }}>{tipoActual.ayuda}</div>
            )}
          </div>
        </div>

        {/* Multiplicidad */}
        <div style={{ display: "grid", gap: "var(--sp-3)" }}>
          <h4 className="section-title">Multiplicidad</h4>

          {esHerenciaODependencia ? (
            <div className="text-subtle" style={{ fontSize: 12 }}>
              La herencia y la dependencia no llevan multiplicidad.
            </div>
          ) : (
            <>
              <div className="text-subtle" style={{ fontSize: 12 }}>
                Cuántos elementos de cada lado participan. Usá <strong>*</strong> para “muchos”.
              </div>

              {[
                {
                  titulo: relation.origen_nombre,
                  min: localMultOrigenMin,
                  max: localMultOrigenMax,
                  setMin: setLocalMultOrigenMin,
                  setMax: setLocalMultOrigenMax,
                  keyMin: "src_mult_min",
                  keyMax: "src_mult_max",
                },
                {
                  titulo: relation.destino_nombre,
                  min: localMultDestinoMin,
                  max: localMultDestinoMax,
                  setMin: setLocalMultDestinoMin,
                  setMax: setLocalMultDestinoMax,
                  keyMin: "dst_mult_min",
                  keyMax: "dst_mult_max",
                },
              ].map((lado) => (
                <div
                  key={lado.keyMin}
                  style={{
                    display: "grid",
                    gap: "var(--sp-2)",
                    padding: "var(--sp-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    background: "var(--surface-2)",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Lado {lado.titulo}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-2)" }}>
                    <div className="field">
                      <label className="label">Mínimo</label>
                      <input
                        className="input input-sm"
                        type="number"
                        min={0}
                        value={lado.min}
                        onChange={(e) => {
                          const val = e.target.value === "" ? null : Number(e.target.value);
                          lado.setMin(e.target.value);
                          fullUpdate({ [lado.keyMin]: val });
                        }}
                      />
                    </div>
                    <div className="field">
                      <label className="label">Máximo</label>
                      <input
                        className="input input-sm"
                        type="text"
                        value={lado.max === null ? "*" : lado.max}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const val = raw === "*" || raw === "" ? null : Number(raw);
                          lado.setMax(raw);
                          fullUpdate({ [lado.keyMax]: val });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Etiqueta */}
        <div className="field">
          <label className="label">Etiqueta (opcional)</label>
          <input
            className="input"
            type="text"
            value={localLabel}
            placeholder="Ej: realiza, pertenece a"
            onChange={(e) => {
              setLocalLabel(e.target.value);
              debouncedUpdate(e.target.value);
            }}
          />
          <div className="text-subtle" style={{ fontSize: 12 }}>
            Texto que se muestra sobre la línea en el diagrama.
          </div>
        </div>

        {/* Posición de la línea */}
        <div style={{ display: "grid", gap: "var(--sp-3)" }}>
          <h4 className="section-title">Posición de la línea</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-2)" }}>
            <div className="field">
              <label className="label">Sale por</label>
              <select
                className="select input-sm"
                value={relation.src_anchor ?? "right"}
                onChange={(e) => fullUpdate({ src_anchor: e.target.value })}
              >
                {ANCHORS.map((a) => (
                  <option key={a.v} value={a.v}>{a.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Llega por</label>
              <select
                className="select input-sm"
                value={relation.dst_anchor ?? "left"}
                onChange={(e) => fullUpdate({ dst_anchor: e.target.value })}
              >
                {ANCHORS.map((a) => (
                  <option key={a.v} value={a.v}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
