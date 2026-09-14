
//src/components/panels/RelationInspector.jsx
import { useState, useEffect } from "react";

// 🔹 Hook personalizado para crear callbacks con "debounce"
//    (espera unos ms antes de ejecutar para no disparar updates en cada tecla)
function useDebouncedCallback(callback, delay) {
  const [timeoutId, setTimeoutId] = useState(null);

  function debounced(...args) {
    if (timeoutId) clearTimeout(timeoutId);          // limpia timer previo
    const id = setTimeout(() => callback(...args), delay); // ejecuta después del delay
    setTimeoutId(id);
  }

  return debounced;
}

export default function RelationInspector({ relation, onUpdate, onDelete }) {
  // 🔹 Si no hay relación seleccionada, mostramos solo un panel vacío
  if (!relation) {
    return (
      <aside style={{ borderLeft: "1px solid #213", padding: 16, color: "#cbd4f5" }}>
        <div style={{ opacity: 0.7 }}>Selecciona una relación para editar</div>
      </aside>
    );
  }

  // 🔹 Estilos en línea para el panel, etiquetas y inputs
  const wrap = { borderLeft: "1px solid #213", padding: 16, color: "#cbd4f5", overflow: "auto" };
  const label = { fontSize: 12, opacity: 0.8, marginBottom: 4, marginTop: 12 };
  const input = {
    width: "100%",
    padding: "8px",
    borderRadius: 8,
    border: "1px solid #334",
    background: "#0e1526",
    color: "#fff"
  };

  // 🔹 Estado local solo para la etiqueta
  //    Esto permite escribir fluido aunque el padre no se actualice aún
  // Estado local de la etiqueta
  const [localLabel, setLocalLabel] = useState(relation.etiqueta ?? "");
  //EMPESANDO EDICION
  //const [localLabel, setLocalLabel] = useState(relation.label ?? "");
  // Estados locales de la multiplicidad
  // const [localMultOrigenMin, setLocalMultOrigenMin] = useState(relation.mult_origen_min ?? "");
  // const [localMultOrigenMax, setLocalMultOrigenMax] = useState(relation.mult_origen_max ?? "");
  // const [localMultDestinoMin, setLocalMultDestinoMin] = useState(relation.mult_destino_min ?? "");
  // const [localMultDestinoMax, setLocalMultDestinoMax] = useState(relation.mult_destino_max ?? "");
  const [localMultOrigenMin, setLocalMultOrigenMin] = useState(relation.src_mult_min ?? "");
  const [localMultOrigenMax, setLocalMultOrigenMax] = useState(
    relation.src_mult_max === null ? "" : relation.src_mult_max
  );
  const [localMultDestinoMin, setLocalMultDestinoMin] = useState(relation.dst_mult_min ?? "");
  const [localMultDestinoMax, setLocalMultDestinoMax] = useState(relation.dst_mult_max ?? "");
  // 🔹 Cada vez que cambie la relación seleccionada (id) o alguno de sus valores,
  //    reseteamos los estados locales
  useEffect(() => {
    // setLocalLabel(relation.etiqueta ?? "");
    setLocalLabel(relation.label ?? "");
    // setLocalMultOrigenMin(relation.src_mult_min ?? "");
    //   setLocalMultOrigenMax(relation.src_mult_max ?? "");
    //   setLocalMultDestinoMin(relation.dst_mult_min ?? "");
    //  setLocalMultDestinoMax(relation.dst_mult_max ?? "");

    // setLocalMultOrigenMin(relation.mult_origen_min ?? "");
    // setLocalMultOrigenMax(relation.mult_origen_max ?? "");
    // setLocalMultDestinoMin(relation.mult_destino_min ?? "");
    // setLocalMultDestinoMax(relation.mult_destino_max ?? "");
    setLocalMultOrigenMin(relation.src_mult_min ?? "");
    setLocalMultOrigenMax(
      relation.src_mult_max === null ? "*" : relation.src_mult_max
    );
    setLocalMultDestinoMin(relation.dst_mult_min ?? "");
    setLocalMultDestinoMax(
      relation.dst_mult_max === null ? "*" : relation.dst_mult_max
    );
  }, [
    // relation?.id,
    // relation?.etiqueta,
    // relation?.mult_origen_min,
    // relation?.mult_origen_max,
    // relation?.mult_destino_min,
    // relation?.mult_destino_max,
    relation?.id,
    relation?.label,          // 👈 ahora sí
    relation?.src_mult_min,
    relation?.src_mult_max,
    relation?.dst_mult_min,
    relation?.dst_mult_max,
  ]);


  const fullUpdate = (patch) => {
    const body = {
      // lo que el backend espera en el PATCH
      // type: patch.type ?? relation.tipo,   // usamos relation.tipo para leer
      // label: patch.label ?? localLabel ?? relation.etiqueta ?? "",
      type: patch.type ?? relation.type,
      label: patch.label ?? localLabel ?? relation.label ?? "",

      src_anchor: patch.src_anchor ?? relation.src_anchor ?? "right",
      dst_anchor: patch.dst_anchor ?? relation.dst_anchor ?? "left",
      src_offset: patch.src_offset ?? relation.src_offset ?? 0,
      dst_offset: patch.dst_offset ?? relation.dst_offset ?? 0,
      src_lane: patch.src_lane ?? relation.src_lane ?? 0,
      dst_lane: patch.dst_lane ?? relation.dst_lane ?? 0,

      // ⚠️ aquí convertimos de los nombres que usa el backend al enviar
      // src_mult_min:
      //   patch.src_mult_min ??
      //   (localMultOrigenMin === "" ? null : Number(localMultOrigenMin)),
      // src_mult_max:
      //   patch.src_mult_max ??
      //   (localMultOrigenMax === "" || localMultOrigenMax === "*"
      //     ? null
      //     : Number(localMultOrigenMax)),
      // dst_mult_min:
      //   patch.dst_mult_min ??
      //   (localMultDestinoMin === "" ? null : Number(localMultDestinoMin)),
      // dst_mult_max:
      //   patch.dst_mult_max ??
      //   (localMultDestinoMax === "" || localMultDestinoMax === "*"
      //     ? null
      //     : Number(localMultDestinoMax)),
      src_mult_min: patch.src_mult_min ?? (localMultOrigenMin === "" ? null : Number(localMultOrigenMin)),
      src_mult_max: patch.src_mult_max ?? (localMultOrigenMax === "*" || localMultOrigenMax === "*" ? null : Number(localMultOrigenMax)),
      dst_mult_min: patch.dst_mult_min ?? (localMultDestinoMin === "" ? null : Number(localMultDestinoMin)),
      dst_mult_max: patch.dst_mult_max ?? (localMultDestinoMax === "*" || localMultDestinoMax === "*" ? null : Number(localMultDestinoMax)),
    };

    console.log("PATCH BODY =>", body); // 👀 para ver qué se manda
    onUpdate(body);
  };

  // 🔹 Versión con debounce para actualizar etiqueta
  const debouncedUpdate = useDebouncedCallback(
    (val) => fullUpdate({ label: val }), // 🚨 igual aquí debería ser "etiqueta"
    400 // espera 400ms desde la última tecla
  );

  return (
    <aside style={wrap}>
      {/* Header con título y botón eliminar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Relación</h3>
        <button
          onClick={onDelete}
          title="Eliminar relación"
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #334",
            background: "transparent",
            color: "inherit",
          }}
        >
          🗑️ Relación
        </button>
      </div>

      {/* ID de la relación */}
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
        Relación ID: {relation.id}
      </div>

      {/* Selector de tipo de relación */}
      <div style={label}>Tipo</div>
      <select
        style={input}
        // value={relation.tipo}
        value={relation.type}
        onChange={(e) => fullUpdate({ type: e.target.value })} // 🚨 debería ser { tipo: ... }
      >
        <option value="ASSOCIATION">Asociación</option>
        <option value="AGGREGATION">Agregación</option>
        <option value="COMPOSITION">Composición</option>
        <option value="INHERITANCE">Herencia</option>
        <option value="DEPENDENCY">Dependencia</option>
      </select>

      {/* Anchors */}
      <div style={label}>Anchor Origen</div>
      <select
        style={input}
        value={relation.src_anchor ?? "right"}
        onChange={(e) => fullUpdate({ src_anchor: e.target.value })}
      >
        <option value="left">Izquierda</option>
        <option value="right">Derecha</option>
        <option value="top">Arriba</option>
        <option value="bottom">Abajo</option>
      </select>

      <div style={label}>Anchor Destino</div>
      <select
        style={input}
        value={relation.dst_anchor ?? "left"}
        onChange={(e) => fullUpdate({ dst_anchor: e.target.value })}
      >
        <option value="left">Izquierda</option>
        <option value="right">Derecha</option>
        <option value="top">Arriba</option>
        <option value="bottom">Abajo</option>
      </select>

      {/* Campo de etiqueta */}
      <div style={label}>Etiqueta (label)</div>
      <input
        style={input}
        type="text"
        value={localLabel} // controlado por estado local
        placeholder={localLabel ? "" : "ej: usa, pertenece, compone"}
        onChange={(e) => {
          setLocalLabel(e.target.value);     // actualiza local al instante
          debouncedUpdate(e.target.value);   // guarda con retardo
        }}
      />

      {/* Multiplicidad */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
        {/* Origen mín */}
        <input
          style={input}
          type="number"
          min={0}
          value={localMultOrigenMin}
          onChange={(e) => {
            const val = e.target.value === "" ? null : Number(e.target.value);
            setLocalMultOrigenMin(e.target.value);   // 👉 actualiza UI en tiempo real
            // fullUpdate({ mult_origen_min: val });    // 👉 manda al padre/backend
            fullUpdate({ src_mult_min: val });
          }}
        />

        {/* Origen máx */}
        <input
          style={input}
          type="text"
          value={localMultOrigenMax === null ? "*" : localMultOrigenMax}
          onChange={(e) => {
            // const val = e.target.value === "*" ? null : Number(e.target.value);
            const val = e.target.value === "*" || e.target.value === ""
              ? null
              : Number(e.target.value);
            setLocalMultOrigenMax(e.target.value);   // 👉 actualiza local
            // fullUpdate({ mult_origen_max: val });    // 👉 manda al padre
            fullUpdate({ src_mult_max: val });
          }}
        />

        {/* Destino mín */}
        <input
          style={input}
          type="number"
          min={0}
          value={localMultDestinoMin}
          onChange={(e) => {
            const val = e.target.value === "" ? null : Number(e.target.value);
            setLocalMultDestinoMin(e.target.value);
            // fullUpdate({ mult_destino_min: val });
            fullUpdate({ dst_mult_min: val });
          }}
        />

        {/* Destino máx */}
        <input
          style={input}
          type="text"
          value={localMultDestinoMax === null ? "*" : localMultDestinoMax}
          onChange={(e) => {
            // const val = e.target.value === "*" ? null : Number(e.target.value);
            const val = e.target.value === "*" || e.target.value === ""
              ? null
              : Number(e.target.value);
            setLocalMultDestinoMax(e.target.value);
            // fullUpdate({ mult_destino_max: val });
            fullUpdate({ dst_mult_max: val });
          }}
        />

      </div>
    </aside>
  );
}
