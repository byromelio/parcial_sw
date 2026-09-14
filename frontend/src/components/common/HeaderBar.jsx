 
export default function HeaderBar({ onLogout, theme = "dark", onToggleTheme }) {
  const isDark = theme === "dark";

  return (
    <header style={{
      display: "flex", alignItems: "center", padding: "0 24px",
      background: "var(--surface-2)", color: "var(--text)", height: 88,
      borderBottom: "1px solid var(--border)"
    }}>
      <div style={{ fontWeight: 800, fontSize: 22 }}>UML AI Tool</div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
        {/* Botón de tema */}
        <button
          onClick={onToggleTheme}
          title={isDark ? "Cambiar a claro" : "Cambiar a oscuro"}
          style={{
            background: "var(--surface)", color: "var(--text)",
            border: "1px solid var(--border)", padding: "8px 12px",
            borderRadius: 10, cursor: "pointer", fontWeight: 700
          }}
        >
          {isDark ? "☀️ Claro" : "🌙 Oscuro"}
        </button>

        <div style={{ border: "2px solid var(--ok)", color: "var(--ok)", padding: "6px 10px", borderRadius: 10, fontWeight: 700 }}>
          API OK
        </div>

        <button
          style={{ background: "var(--danger)", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}
          onClick={onLogout}
        >
          Salir
        </button>
      </div>
    </header>
  );
}
