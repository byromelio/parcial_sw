 
export default function Sidebar({
  name, setName,
  attrs, setAttrs,
  loading, msg,
  classes,
  onAddAttr,
  onCreate,
}) {
  const input = {
    width: "100%",
    border: "2px solid var(--border)",
    borderRadius: 10,
    padding: "10px 12px",
    background: "var(--bg)",
    color: "var(--text)"
  };
  const label = { fontSize: 12, color: "var(--text-muted)", marginBottom: 6 };

  return (
    <aside style={{ background: "var(--surface)", borderRight: "1px solid var(--border)", padding: 24, overflow: "auto" }}>
      <h2 style={{ margin: "0 0 16px", fontSize: 22, color: "var(--text)" }}>Crear Clase</h2>

      <div style={label}>Nombre</div>
      <input style={input} placeholder="Nombre de clase" value={name} onChange={e => setName(e.target.value)} />

      <div style={{ ...label, marginTop: 14 }}>Atributos</div>
      {attrs.map((a, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 140px 1fr", gap: 8, marginBottom: 10, alignItems: "center" }}>
          <input style={input} placeholder="nombre" value={a.nombre}
                 onChange={e => setAttrs(p => p.map((x, idx) => idx === i ? { ...x, nombre: e.target.value } : x))} />
          <input style={input} placeholder="tipo" value={a.tipo}
                 onChange={e => setAttrs(p => p.map((x, idx) => idx === i ? { ...x, tipo: e.target.value } : x))} />
          <label style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text)" }}>
            <input type="checkbox" checked={a.requerido}
                   onChange={e => setAttrs(p => p.map((x, idx) => idx === i ? { ...x, requerido: e.target.checked } : x))} />
            <span style={{ fontSize: 14 }}>Requerido</span>
          </label>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 18 }}>
        <button style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", padding: "10px 12px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}
                type="button" onClick={onAddAttr}>+ Atributo</button>
        <button style={{ background: "var(--accent)", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontWeight: 700, flex: 1, opacity: loading || !name.trim() ? 0.7 : 1 }}
                onClick={onCreate} disabled={loading || !name.trim()}>
          {loading ? "Creando…" : "Crear Clase"}
        </button>
      </div>

      {msg && <div style={{ fontSize: 12, color: "var(--text)" }}>{msg}</div>}

      <h2 style={{ margin: "16px 0 10px", fontSize: 22, color: "var(--text)" }}>Clases</h2>
      <ul style={{ margin: 0, padding: "0 0 0 18px", lineHeight: 1.8, color: "var(--text)" }}>
        {classes.map(c => <li key={c.id}>{c.nombre} (id {c.id})</li>)}
      </ul>
    </aside>
  );
}
