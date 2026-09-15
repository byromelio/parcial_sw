// src/components/layout/LeftPanel.jsx
import Icon from "../common/Icon";

const REL_LABEL = {
  ASSOCIATION: "Asociación",
  AGGREGATION: "Agregación",
  COMPOSITION: "Composición",
  INHERITANCE: "Herencia",
  DEPENDENCY: "Dependencia",
};

export default function LeftPanel({
  classes = [],
  relations = [],
  selectedId,
  selectedRelId,
  onSelectClass,
  onSelectRelation,
}) {
  return (
    <aside
      className="scroll"
      style={{
        width: "var(--panel-w)",
        borderRight: "1px solid var(--border)",
        background: "var(--surface-1)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ---------- Clases ---------- */}
      <div style={{ padding: "var(--sp-4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="section-title">
            <Icon name="class" size={13} />
            Clases
          </h3>
          <span className="badge badge-muted">{classes.length}</span>
        </div>

        {classes.length === 0 ? (
          <p className="text-subtle" style={{ fontSize: 12, margin: "var(--sp-3) 0 0" }}>
            Todavía no hay clases. Usá <strong>Nueva clase</strong> arriba o pedíselo al asistente.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "var(--sp-3) 0 0", display: "grid", gap: 2 }}>
            {classes.map((c) => {
              const active = c.id === selectedId;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => onSelectClass?.(c.id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--sp-2)",
                      padding: "6px var(--sp-2)",
                      border: "1px solid transparent",
                      borderRadius: "var(--radius-sm)",
                      background: active ? "var(--accent-soft)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text)",
                      font: "inherit",
                      fontSize: 13,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <Icon name="class" size={14} />
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.nombre}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <hr className="divider" />

      {/* ---------- Relaciones ---------- */}
      <div style={{ padding: "var(--sp-4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="section-title">
            <Icon name="relation" size={13} />
            Relaciones
          </h3>
          <span className="badge badge-muted">{relations.length}</span>
        </div>

        {relations.length === 0 ? (
          <p className="text-subtle" style={{ fontSize: 12, margin: "var(--sp-3) 0 0" }}>
            Arrastrá desde el borde de una clase hasta otra para conectarlas.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "var(--sp-3) 0 0", display: "grid", gap: 2 }}>
            {relations.map((r) => {
              const active = r.id === selectedRelId;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => onSelectRelation?.(r.id)}
                    style={{
                      width: "100%",
                      display: "grid",
                      gap: 1,
                      padding: "6px var(--sp-2)",
                      border: "1px solid transparent",
                      borderRadius: "var(--radius-sm)",
                      background: active ? "var(--accent-soft)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text)",
                      font: "inherit",
                      fontSize: 13,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.origen_nombre} → {r.destino_nombre}
                    </span>
                    <span className="text-subtle" style={{ fontSize: 11 }}>
                      {REL_LABEL[r.type] || r.type}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ---------- Ayuda rápida, siempre visible ---------- */}
      <div style={{ marginTop: "auto", padding: "var(--sp-4)", borderTop: "1px solid var(--border)" }}>
        <h3 className="section-title" style={{ marginBottom: "var(--sp-3)" }}>
          Cómo trabajar
        </h3>
        <ol
          className="text-muted"
          style={{ margin: 0, paddingLeft: 16, fontSize: 12, display: "grid", gap: "var(--sp-2)" }}
        >
          <li>Creá clases con <strong>Nueva clase</strong> y un clic en el lienzo.</li>
          <li>Seleccioná una clase para editar sus atributos a la derecha.</li>
          <li>Conectá clases arrastrando desde su borde.</li>
          <li>O pedíselo todo al <strong>asistente</strong>, abajo a la derecha.</li>
        </ol>
      </div>
    </aside>
  );
}
