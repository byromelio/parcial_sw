// src/components/panels/Inspector.jsx
//
// Panel derecho: edición de la clase seleccionada (nombre, atributos y
// métodos). La lógica de guardado no cambió; lo que se rehízo es la
// presentación, para que quede claro qué es cada campo y qué efecto tiene
// sobre el backend que se genera después.

import { useEffect, useRef, useState } from "react";
import { updateClass } from "../../api/classes";
import Icon from "../common/Icon";

function useDebouncedCallback(cb, delay = 600) {
  const t = useRef(null);
  return (...args) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => cb(...args), delay);
  };
}

const TYPE_OPTIONS = [
  { v: "string", label: "Texto (string)" },
  { v: "text", label: "Texto largo (text)" },
  { v: "int", label: "Número entero (int)" },
  { v: "float", label: "Número decimal (float)" },
  { v: "decimal", label: "Decimal exacto (decimal)" },
  { v: "boolean", label: "Sí / No (boolean)" },
  { v: "date", label: "Fecha (date)" },
  { v: "datetime", label: "Fecha y hora (datetime)" },
  { v: "uuid", label: "Identificador (uuid)" },
  { v: "email", label: "Correo (email)" },
];

export default function Inspector({
  selected,
  details,
  onRename,
  onDeleteClass,
  reloadDetails,
  onAddAttr,
  onPatchAttr,
  onRemoveAttr,
  onAddMeth,
  onPatchMeth,
  onRemoveMeth,
}) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setMsg("");
    setSavingName(false);
    setName(selected ? selected.name : "");
  }, [selected?.id, selected?.name]);

  const debouncedSaveName = useDebouncedCallback(async (val) => {
    if (!selected?.id) return;
    try {
      setSavingName(true);
      const updated = await updateClass(selected.id, { name: val });
      setName(updated.name);
    } catch (e) {
      setMsg(e?.response?.data?.detail || "No se pudo guardar el nombre");
    } finally {
      setSavingName(false);
    }
  }, 600);

  function onChangeName(val) {
    setName(val);
    debouncedSaveName(val);
    onRename?.(val);
  }

  const asideStyle = {
    width: "var(--inspector-w)",
    borderLeft: "1px solid var(--border)",
    background: "var(--surface-1)",
    display: "flex",
    flexDirection: "column",
  };

  // ---------- Sin selección ----------
  if (!selected) {
    return (
      <aside style={asideStyle}>
        <div
          style={{
            margin: "auto",
            padding: "var(--sp-5)",
            textAlign: "center",
            display: "grid",
            gap: "var(--sp-3)",
            justifyItems: "center",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--radius)",
              background: "var(--surface-2)",
              color: "var(--text-subtle)",
            }}
          >
            <Icon name="cursor" size={20} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Nada seleccionado</div>
          <div className="text-muted" style={{ fontSize: 12, maxWidth: 220 }}>
            Hacé clic en una clase del lienzo para ver y editar sus atributos y métodos acá.
          </div>
        </div>
      </aside>
    );
  }

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
        <Icon name="class" size={15} style={{ color: "var(--accent)" }} />
        <strong style={{ fontSize: 13, flex: 1 }}>Clase</strong>
        <button
          className="btn btn-danger-ghost btn-sm"
          onClick={onDeleteClass}
          title="Eliminar esta clase del diagrama"
        >
          <Icon name="trash" size={14} />
          Eliminar
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, padding: "var(--sp-4)", display: "grid", gap: "var(--sp-5)", alignContent: "start" }}>
        {/* ---------- Nombre ---------- */}
        <div className="field">
          <label className="label">Nombre de la clase</label>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              value={name}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder="Ej: Cliente"
            />
            {savingName && (
              <span
                className="text-subtle"
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11 }}
              >
                guardando…
              </span>
            )}
          </div>
          {msg && (
            <div style={{ fontSize: 12, color: "var(--danger)", display: "flex", gap: 6, alignItems: "center" }}>
              <Icon name="warning" size={13} />
              {msg}
            </div>
          )}
        </div>

        {/* ---------- Atributos ---------- */}
        <div style={{ display: "grid", gap: "var(--sp-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <h4 className="section-title" style={{ flex: 1 }}>
              <Icon name="attribute" size={13} />
              Atributos
            </h4>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={reloadDetails}
              disabled={!reloadDetails}
              title="Volver a cargar desde el servidor"
            >
              <Icon name="refresh" size={14} />
            </button>
            <button className="btn btn-sm" onClick={() => onAddAttr(selected.id)} disabled={!details}>
              <Icon name="plus" size={14} />
              Agregar
            </button>
          </div>

          {!details ? (
            <div className="text-muted" style={{ fontSize: 12 }}>
              Cargando…
            </div>
          ) : details.attrs.length === 0 ? (
            <div className="text-subtle" style={{ fontSize: 12 }}>
              Esta clase no tiene atributos. Cada atributo se convierte en una columna de la
              tabla al generar el backend.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "var(--sp-3)" }}>
              {details.attrs.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "grid",
                    gap: "var(--sp-2)",
                    padding: "var(--sp-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    background: "var(--surface-2)",
                  }}
                >
                  <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                    <input
                      className="input input-sm"
                      value={a.name ?? a.nombre ?? ""}
                      onChange={(e) => onPatchAttr(selected.id, a.id, { name: e.target.value })}
                      placeholder="Nombre del atributo"
                    />
                    <button
                      className="btn btn-danger-ghost btn-icon btn-sm"
                      onClick={() => onRemoveAttr(selected.id, a.id)}
                      title="Eliminar atributo"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                  <select
                    className="select input-sm"
                    value={a.type ?? a.tipo ?? "string"}
                    onChange={(e) => onPatchAttr(selected.id, a.id, { type: e.target.value })}
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <label
                    style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", fontSize: 12, cursor: "pointer" }}
                    title="Si está marcado, el campo será obligatorio (NOT NULL) en la base de datos"
                  >
                    <input
                      type="checkbox"
                      checked={!!a.required}
                      onChange={(e) => onPatchAttr(selected.id, a.id, { required: e.target.checked })}
                    />
                    <span className="text-muted">Obligatorio (NOT NULL)</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------- Métodos ---------- */}
        <div style={{ display: "grid", gap: "var(--sp-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <h4 className="section-title" style={{ flex: 1 }}>
              <Icon name="method" size={13} />
              Métodos
            </h4>
            <button className="btn btn-sm" onClick={() => onAddMeth(selected.id)} disabled={!details}>
              <Icon name="plus" size={14} />
              Agregar
            </button>
          </div>

          {!details ? (
            <div className="text-muted" style={{ fontSize: 12 }}>
              Cargando…
            </div>
          ) : details.meths.length === 0 ? (
            <div className="text-subtle" style={{ fontSize: 12 }}>
              Sin métodos. Son opcionales: no afectan a las tablas generadas.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "var(--sp-3)" }}>
              {details.meths.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gap: "var(--sp-2)",
                    padding: "var(--sp-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    background: "var(--surface-2)",
                  }}
                >
                  <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                    <input
                      className="input input-sm"
                      value={m.name ?? ""}
                      onChange={(e) => onPatchMeth(selected.id, m.id, { name: e.target.value })}
                      placeholder="Nombre del método"
                    />
                    <button
                      className="btn btn-danger-ghost btn-icon btn-sm"
                      onClick={() => onRemoveMeth(selected.id, m.id)}
                      title="Eliminar método"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                  <select
                    className="select input-sm"
                    value={m.return_type ?? "void"}
                    onChange={(e) => onPatchMeth(selected.id, m.id, { return_type: e.target.value })}
                  >
                    <option value="void">Sin retorno (void)</option>
                    {TYPE_OPTIONS.filter((o) => o.v !== "uuid").map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
