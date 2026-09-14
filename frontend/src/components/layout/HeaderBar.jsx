// src/components/layout/HeaderBar.jsx
//(mismos estilos/acciones)
export default function HeaderBar({
  diagram,
  email,
  theme,
  toggleTheme,
  onBack,
  insertName, setInsertName,
  insertMode, setInsertMode,
  onLogout,
     onExport,   // 👈 nueva prop
  exporting,
}) {
  const input = {
    width: "100%",
    height: 32,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid #334",
    background: "#0e1526",
    color: "#fff",
    boxSizing: "border-box",
  };

  return (
    <header
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 16px", borderBottom: "1px solid #213",
        background: "rgba(0,0,0,.15)",
      }}
    >
      <button
        onClick={onBack}
        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #334", background: "transparent", color: "inherit" }}
      >
        ← Volver
      </button>
      <strong style={{ fontSize: 16 }}>{diagram.title}</strong>
      <span style={{ fontSize: 12, opacity: 0.8 }}>ID: {diagram.id}</span>
      <span style={{ fontSize: 12, opacity: 0.8, marginLeft: 8 }}>
        Actualizado: {new Date(diagram.updated_at).toLocaleString()}
      </span>
<button
  onClick={onExport}
  disabled={exporting}
  style={{
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #334",
    background: exporting ? "#888" : "#4f46e5",
    color: "#fff",
    fontWeight: 600,
  }}
>
  {exporting ? "Exportando…" : "⬇ Exportar backend"}
</button>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <input
          value={insertName}
          onChange={(e) => setInsertName(e.target.value)}
          placeholder="Nombre a insertar"
          style={{ ...input, width: 180 }}
        />

        {/* para insertar la clase */}
        <button
          onClick={() => setInsertMode((v) => !v)}
          style={{
            padding: "6px 10px", borderRadius: 8, border: "1px solid #334",
            background: insertMode ? "#334" : "transparent", color: "inherit", fontWeight: 600,
          }}
          title="Modo insertar: click en la hoja crea una clase"
        >
          {insertMode ? "🟢 Insertando…" : "➕ Insertar clase"}
        </button>
        <span style={{ fontSize: 12, opacity: 0.8 }}>{email}</span>
        <button
          onClick={toggleTheme}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #334", background: "transparent", color: "inherit" }}
        >
          {theme === "dark" ? "🌙" : "☀️"}
        </button>
        <button
          onClick={onLogout}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #334", background: "transparent", color: "inherit" }}
        >
          Salir
        </button>
      </div>
    </header>
  );
}
