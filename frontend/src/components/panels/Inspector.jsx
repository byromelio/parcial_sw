//src/components/panels/Inspector.jsx
//EDITANDO...1.1
import { useEffect, useRef, useState } from "react";
// import {
//   createAttribute,
//   updateAttribute,
//   deleteAttribute,
//   createMethod,
//   updateMethod,
//   deleteMethod,
// } from "../../api/classes";
import { updateClass } from "../../api/classes";
// import useAttributes from "../../hooks/useAttributes";
// import useMethods from "../../hooks/useMethods";

function useDebouncedCallback(cb, delay = 600) {
  const t = useRef(null);
  return (...args) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => cb(...args), delay);
  };
}

const TYPE_OPTIONS = [
  { v: "string", label: "string" },
  { v: "text", label: "text" },
  { v: "int", label: "int" },
  { v: "float", label: "float" },
  { v: "decimal", label: "decimal" },
  { v: "boolean", label: "boolean" },
  { v: "date", label: "date" },
  { v: "datetime", label: "datetime" },
  { v: "uuid", label: "uuid" },
  { v: "email", label: "email" },
];

const inputBase = {
  width: "100%",
  height: 34,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #334",
  background: "#0e1526",
  color: "#fff",
  boxSizing: "border-box",
};
const selectBase = {
  ...inputBase,
  appearance: "none",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, #9aa4c7 50%), linear-gradient(135deg, #9aa4c7 50%, transparent 50%), linear-gradient(#0e1526 0 0)",
  backgroundPosition: "calc(100% - 18px) 50%, calc(100% - 12px) 50%, 0 0",
  backgroundSize: "6px 6px, 6px 6px, 100% 100%",
  backgroundRepeat: "no-repeat",
};

export default function Inspector({
  selected,
  details,
  onRename,
  onDetailsChange,
  reloadDetails,
  onDeleteClass,
  onAddAttr, onPatchAttr, onRemoveAttr,
  onAddMeth, onPatchMeth, onRemoveMeth }) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  const [savingName, setSavingName] = useState(false);







  useEffect(() => {
    setMsg("");
    setSavingName(false);
    setName(selected ? selected.name : "");
  }, [selected?.id, selected?.name]);
  // autosave nombre

  const debouncedSaveName = useDebouncedCallback(async (val) => {
    if (!selected?.id) return;
    try {
      setSavingName(true);
      const updated = await updateClass(selected.id, { name: val }); // 👈 aquí llamamos directo al API

      setName(updated.name); // sincronizamos estado


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


  if (!selected) {
    return (
      <aside style={{ borderLeft: "1px solid #213", padding: 16, color: "#cbd4f5" }}>
        <div style={{ opacity: 0.7 }}>Selecciona una clase para editar</div>
      </aside>
    );
  }

  return (
    <aside style={{ borderLeft: "1px solid #213", padding: 16, overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Inspector</h3>
        <button
          onClick={onDeleteClass}
          title="Eliminar clase"
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #334",
            background: "transparent",
            color: "inherit",
          }}
        >
          🗑️ Clase
        </button>
      </div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Clase ID: {selected.id}</div>

      {/* Nombre */}
      <label style={{ fontSize: 12, opacity: 0.8, display: "block", marginBottom: 4 }}>Nombre</label>
      <div style={{ position: "relative" }}>
        <input
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          style={{ ...inputBase, height: 36 }}
          placeholder="Nombre de la clase"
          title="Nombre visible y del modelo"
        />
        {savingName && (
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            guardando…
          </span>
        )}
      </div>

      {msg && <div style={{ marginTop: 8, fontSize: 12, color: "salmon" }}>{msg}</div>}

      {/* ATRIBUTOS */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
        <h4 style={{ margin: 0 }}>Atributos</h4>

        {/* ORIGINAL
      <button onClick={addAttr}
      */}
        <button onClick={() => onAddAttr(selected.id)}
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #334",
            background: "transparent",
            color: "inherit",
          }}
          title="Agregar atributo"
          disabled={!details}
        >
          + agregar
        </button>

        <button
          onClick={reloadDetails}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #334",
            background: "transparent",
            color: "inherit",
          }}
          title="Refrescar desde servidor"
          disabled={!reloadDetails}
        >
          ↻
        </button>
      </div>

      {/* Cabecera */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 84px 40px",
          gap: 8,
          marginTop: 6,
          fontSize: 12,
          opacity: 0.7,
        }}
      >
        <div>Nombre</div>
        <div>Tipo</div>
        <div title="Requerido = NOT NULL en BD">Requerido</div>
        <div> </div>
      </div>

      <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
        {!details ? (
          <div style={{ opacity: 0.8 }}>Cargando…</div>
        ) : details.attrs.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 12 }}>Sin atributos</div>
        ) : (
          details.attrs.map((a) => (
            <div
              key={a.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 84px 40px",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                value={a.name ?? a.nombre ?? ""}
                /* ORIGINAL onChange={(e) => patchAttr(a.id, { name: e.target.value }) */
                onChange={(e) => onPatchAttr(selected.id, a.id, { name: e.target.value })}
                placeholder="nombre"
                style={inputBase}
                title="Nombre del campo"
              />
              <select
                value={a.type ?? a.tipo ?? "string"}
                /* ORIGINAL onChange={(e) => patchAttr(a.id, { type: e.target.value }) */
                onChange={(e) => onPatchAttr(selected.id, a.id, { type: e.target.value })}
                style={selectBase}
                title="Tipo de dato"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </select>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontSize: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={!!a.required}
                  /* ORIGINAL onChange={(e) => patchAttr(a.id, { required: e.target.checked }) */
                  onChange={(e) => onPatchAttr(selected.id, a.id, { required: e.target.checked })}
                  title="Si está marcado, el campo es NOT NULL (obligatorio)"
                />
                <span style={{ opacity: 0.85 }}>Sí</span>
              </label>

              {/* ORIGINAL onClick={() => removeAttr(a.id)} */}
              <button
                onClick={() => onRemoveAttr(selected.id, a.id)}
                title="Eliminar atributo"
                style={{
                  border: "1px solid #334",
                  background: "transparent",
                  color: "inherit",
                  borderRadius: 8,
                  padding: "6px 8px",
                }}
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>

      {/* MÉTODOS */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
        <h4 style={{ margin: 0 }}>Métodos</h4>

        {/* ORIGINAL onClick={addMeth} */}
        <button
          onClick={() => onAddMeth(selected.id)}
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #334",
            background: "transparent",
            color: "inherit",
          }}
          title="Agregar método"
          disabled={!details}
        >
          + agregar
        </button>
      </div>

      {/* Cabecera */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 40px",
          gap: 8,
          marginTop: 6,
          fontSize: 12,
          opacity: 0.7,
        }}
      >
        <div>Nombre</div>
        <div>Retorno</div>
        <div> </div>
      </div>

      <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
        {!details ? (
          <div style={{ opacity: 0.8 }}>Cargando…</div>
        ) : details.meths.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 12 }}>Sin métodos</div>
        ) : (
          details.meths.map((m) => (
            <div
              key={m.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 40px",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                value={m.name ?? ""}
                /* ORIGINAL onChange={(e) => patchMeth(m.id, { name: e.target.value }) */
                onChange={(e) => onPatchMeth(selected.id, m.id, { name: e.target.value })}
                placeholder="nombre"
                style={inputBase}
                title="Nombre del método"
              />
              <select
                value={m.return_type ?? "void"}
                /* ORIGINAL onChange={(e) => patchMeth(m.id, { return_type: e.target.value }) */
                onChange={(e) => onPatchMeth(selected.id, m.id, { return_type: e.target.value })}
                style={selectBase}
                title="Tipo de retorno"
              >
                <option value="void">void</option>
                {TYPE_OPTIONS.filter((o) => o.v !== "uuid").map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </select>

              {/* ORIGINAL onClick={() => removeMeth(m.id)} */}
              <button
                onClick={() => onRemoveMeth(selected.id, m.id)}
                title="Eliminar método"
                style={{
                  border: "1px solid #334",
                  background: "transparent",
                  color: "inherit",
                  borderRadius: 8,
                  padding: "6px 8px",
                }}
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, opacity: 0.75 }}>
        <strong>Requerido</strong> = NOT NULL en la base de datos (campo obligatorio).
      </div>
    </aside>
  );

}
