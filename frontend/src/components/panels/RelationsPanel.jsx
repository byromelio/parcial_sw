//para crear nueva relacions
// src/components/panels/RelationsPanel.jsx
export default function RelationsPanel({
  classes = [],
  relMode, setRelMode,
  relType, setRelType,
  relA, setRelA,
  relB, setRelB,
  multAmin, setMultAmin,
  multAmax, setMultAmax,
  multBmin, setMultBmin,
  multBmax, setMultBmax,
  label, setLabel,
  onCreate,
}) {
  const wrap = { background:"var(--surface)", borderLeft:"1px solid var(--border)", padding:20, overflow:"auto", height:"100%", color:"var(--text)" };
  const labelStyle = { fontSize:12, color:"var(--text-muted)", marginBottom:6, marginTop:14 };
  const input = { width:"100%", border:"2px solid var(--border)", borderRadius:10, padding:"10px 12px", background:"var(--bg)", color:"var(--text)" };
  const h2 = { margin:"0 0 12px", fontSize:20, fontWeight:800, color:"var(--text)" };
  const btn = { background:"var(--accent)", color:"#fff", border:"none", padding:"10px 14px", borderRadius:10, cursor:"pointer", fontWeight:700, width:"100%", marginTop:16 };
  const toggle = { marginBottom:12, display:"flex", alignItems:"center", gap:10 };

  // validación simple
  const multiplicidadValida =
    (multAmin == null || multAmin >= 0) &&
    (multBmin == null || multBmin >= 0) &&
    (multAmax == null || multAmin == null || multAmax >= multAmin) &&
    (multBmax == null || multBmin == null || multBmax >= multBmin);

  return (
    <aside style={wrap}>
      <h2 style={h2}>Relaciones</h2>

      <label style={toggle}>
        <input type="checkbox" checked={relMode} onChange={e=>setRelMode(e.target.checked)} />
        <span>Modo crear relación (clic en A y luego en B en el canvas)</span>
      </label>

      <div style={labelStyle}>Origen</div>
      <select style={input} value={relA ?? ""} onChange={e=>setRelA(e.target.value || null)}>
        <option value="">Seleccionar…</option>
        {classes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>

      <div style={labelStyle}>Destino</div>
      <select style={input} value={relB ?? ""} onChange={e=>setRelB(e.target.value || null)}>
        <option value="">Seleccionar…</option>
        {classes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>

      <div style={labelStyle}>Tipo</div>
      <select style={input} value={relType} onChange={e=>setRelType(e.target.value)}>
        <option value="ASSOCIATION">Asociación</option>
        <option value="AGGREGATION">Agregación</option>
        <option value="COMPOSITION">Composición</option>
        <option value="INHERITANCE">Herencia</option>
        <option value="DEPENDENCY">Dependencia</option>
      </select>

      {/* Label */}
      <div style={labelStyle}>Etiqueta (label)</div>
      <input
        style={input}
        type="text"
        value={label ?? ""}
        placeholder="ej: usa, pertenece, compone"
        onChange={(e) => setLabel(e.target.value)}
      />

      {/* Multiplicidad */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
        <div>
          <div style={labelStyle}>Origen mín</div>
          <input
            style={input}
            type="number"
            min={0}
            value={multAmin ?? ""}
            onChange={(e) => setMultAmin(e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
        <div>
          <div style={labelStyle}>Origen máx</div>
          <input
            style={input}
            type="text"
            value={multAmax == null ? "*" : multAmax}
            onChange={(e) =>
              setMultAmax(e.target.value === "" ? null : (e.target.value === "*" ? null : Number(e.target.value)))
            }
          />
        </div>
        <div>
          <div style={labelStyle}>Destino mín</div>
          <input
            style={input}
            type="number"
            min={0}
            value={multBmin ?? ""}
            onChange={(e) => setMultBmin(e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
        <div>
          <div style={labelStyle}>Destino máx</div>
          <input
            style={input}
            type="text"
            value={multBmax == null ? "*" : multBmax}
            onChange={(e) =>
              setMultBmax(e.target.value === "" ? null : (e.target.value === "*" ? null : Number(e.target.value)))
            }
          />
        </div>
      </div>

      <button
        style={btn}
        onClick={onCreate}
        disabled={!relA || !relB || !multiplicidadValida}
      >
        Crear relación
      </button>
    </aside>
  );
}
