// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../store/auth";
import useTheme from "../hooks/useTheme";
import ApiStatusBadge from "../components/common/ApiStatusBadge";

// helpers del módulo diagrams
import {
  listDiagrams as apiListDiagrams,
  createDiagram as apiCreateDiagram,
  deleteDiagram as apiDeleteDiagram,
} from "../api/diagrams";

export default function HomePage() {
  const nav = useNavigate();
  const logout = useAuth((s) => s.logout);
  const email = useAuth((s) => s.email);
  const { theme, toggleTheme } = useTheme();

  const [title, setTitle] = useState("");
  const [diagrams, setDiagrams] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // === Cargar diagramas ===
  async function load() {
    setLoading(true);
    setMsg("");
    console.log("🔄 Cargando diagramas...", { page, limit });

    try {
      const data = await apiListDiagrams({ page, limit });
      console.log("✅ Diagramas recibidos:", data);

      setDiagrams(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch (e) {
      console.error("❌ Error cargando diagramas:", e);
      console.error("❌ Respuesta error:", e?.response?.status, e?.response?.data);

      setMsg(e?.response?.data?.detail || "Error al cargar diagramas");
      setDiagrams([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // === Crear diagrama ===
  async function createDiagram(e) {
    e?.preventDefault?.();
    if (!title.trim()) return;

    setMsg("");
    console.log("🆕 Creando diagrama con título:", title);

    try {
      const d = await apiCreateDiagram(title.trim());
      console.log("✅ Diagrama creado:", d);

      setTitle("");
      await load();
      nav(`/diagram/${d.id}`);
    } catch (e) {
      console.error("❌ Error creando diagrama:", e);
      console.error("❌ Respuesta error:", e?.response?.status, e?.response?.data);

      setMsg(e?.response?.data?.detail || "No se pudo crear");
    }
  }

  // === Eliminar diagrama ===
  async function removeDiagram(id) {
    if (!confirm("¿Eliminar diagrama?")) return;

    console.log("🗑️ Eliminando diagrama:", id);

    try {
      await apiDeleteDiagram(id);
      console.log("✅ Diagrama eliminado:", id);

      await load();
    } catch (e) {
      console.error("❌ Error eliminando diagrama:", e);
      console.error("❌ Respuesta error:", e?.response?.status, e?.response?.data);

      alert(e?.response?.data?.detail || "No se pudo eliminar");
    }
  }

  // === Paginación ===
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "64px 1fr",
        height: "100vh",
        background: "var(--bg, #0b1020)",
        color: "var(--text, #eaeefb)",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          borderBottom: "1px solid #213",
          background: "rgba(0,0,0,.15)",
        }}
      >
        <strong>UML AI Tool</strong>
        <ApiStatusBadge />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{email}</span>
          <button
            onClick={toggleTheme}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #334",
              background: "transparent",
              color: "inherit",
            }}
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
          <button
            onClick={() => {
              logout();
              nav("/login", { replace: true });
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #334",
              background: "transparent",
              color: "inherit",
            }}
          >
            Salir
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ padding: 16, maxWidth: 900, margin: "0 auto", width: "100%" }}>
        <h3 style={{ marginTop: 0 }}>Diagramas</h3>

        {/* Crear */}
        <form onSubmit={createDiagram} style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mi primer diagrama"
            style={{
              width: "100%",
              height: 40,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid #334",
              background: "#0e1526",
              color: "#fff",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="submit"
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: "#4f46e5",
                color: "#fff",
              }}
            >
              Crear
            </button>
            {msg && <div style={{ fontSize: 12, opacity: 0.8 }}>{msg}</div>}
          </div>
        </form>

        {/* Lista */}
        {loading ? (
          <div>Cargando…</div>
        ) : diagrams.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 14 }}>No hay diagramas.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {diagrams.map((d) => (
              <li key={d.id} style={{ border: "1px solid #334", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{d.title}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{d.id}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => nav(`/diagram/${d.id}`)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #334",
                        background: "transparent",
                        color: "inherit",
                      }}
                    >
                      Abrir
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDiagram(d.id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #334",
                        background: "transparent",
                        color: "inherit",
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Paginación */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #334",
              background: "transparent",
              color: "inherit",
              opacity: page <= 1 ? 0.5 : 1,
            }}
          >
            ←
          </button>
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            Página {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #334",
              background: "transparent",
              color: "inherit",
              opacity: page >= totalPages ? 0.5 : 1,
            }}
          >
            →
          </button>
        </div>
      </main>
    </div>
  );
}
