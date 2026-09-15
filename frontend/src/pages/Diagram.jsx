// frontend/src/pages/Diagram.jsx

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// ===== utilidades geométricas para canvas =====
import { hitTestClasses, inferClosestSide } from "../components/canvas/utils/geometry";

// ===== estado global (auth) =====
import useAuth from "../store/auth";

// ===== hooks personalizados (lógica de negocio) =====
import useTheme from "../hooks/useTheme";
import useDiagram from "../hooks/useDiagram";
import useClassesAndDetails from "../hooks/useClassesAndDetails";
import useRelations from "../hooks/useRelations";
import useExportDiagram from "../hooks/useExport";

// ===== componentes de UI =====
import Sheet from "../components/canvas/Sheet";
import ClassCard from "../components/canvas/ClassCard";
import ConnectionLayer from "../components/canvas/ConnectionLayer";
import Inspector from "../components/panels/Inspector";
import RelationInspector from "../components/panels/RelationInspector";
import AiAssistantPanel from "../components/panels/AiAssistantPanel";
import HelpGuide from "../components/common/HelpGuide";
import Icon from "../components/common/Icon";

// ===== layout =====
import HeaderBar from "../components/layout/HeaderBar";
import LeftPanel from "../components/layout/LeftPanel";

const HELP_SEEN_KEY = "uml.help.seen";

export default function DiagramDashboard() {
  const { id } = useParams();
  const nav = useNavigate();

  const logout = useAuth((s) => s.logout);
  const email = useAuth((s) => s.email);

  const { theme, toggleTheme } = useTheme();
  const { diagram, loading, err } = useDiagram(id);

  const [linking, setLinking] = useState(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 });
  const [showHelp, setShowHelp] = useState(false);

  const { exportDiagram, loading: exporting } = useExportDiagram();

  const {
    relations,
    selectedRelId, setSelectedRelId,
    selectedRelation: selectedRel,
    createRelation, updateRelation, deleteRelation,
  } = useRelations(diagram);

  const {
    classes,
    selectedId, setSelectedId, selected,
    detailsByClass,
    insertMode, setInsertMode,
    insertName, setInsertName,
    fetchDetails,
    handleCanvasClick,
    handleDragEnd, handleResizeEnd,
    handleDelete,
    addAttr, patchAttr, removeAttr,
    addMeth, patchMeth, removeMeth,
  } = useClassesAndDetails(diagram);

  // La guía se abre sola la primera vez que alguien usa la herramienta.
  useEffect(() => {
    if (!localStorage.getItem(HELP_SEEN_KEY)) setShowHelp(true);
  }, []);

  const closeHelp = () => {
    localStorage.setItem(HELP_SEEN_KEY, "1");
    setShowHelp(false);
  };

  // =====================================================
  // Crear relación arrastrando entre clases
  // =====================================================
  useEffect(() => {
    if (!linking) return;

    const hitTestByDom = (pt) => {
      const stack = document.elementsFromPoint(pt.x, pt.y) || [];
      const el = stack.find((n) => n?.getAttribute && n.getAttribute("data-class-id"));
      return el ? el.getAttribute("data-class-id") || null : null;
    };

    const onMove = (e) => {
      setLinking((prev) => (prev ? { ...prev, cursor: { x: e.clientX, y: e.clientY } } : prev));
    };

    const onUp = async (e) => {
      const pt = { x: e.clientX, y: e.clientY };
      const toId = hitTestByDom(pt) || hitTestClasses(pt, classes);

      if (toId) {
        const dstSide = inferClosestSide(toId, pt);
        try {
          await createRelation({
            from_class: linking.fromId,
            to_class: toId,
            type: "ASSOCIATION",
            src_anchor: linking.fromSide,
            dst_anchor: dstSide,
          });
        } catch (err) {
          alert(err?.response?.data?.detail || "No se pudo crear la relación");
        }
      }
      setLinking(null);
    };

    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
    return () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
    };
  }, [linking, classes, diagram?.id]);

  // =====================================================
  // Carga / error
  // =====================================================
  if (loading) {
    return (
      <div style={{ height: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--text)" }}>
        <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }} className="text-muted">
          <Icon name="loader" className="spinning" />
          Cargando diagrama…
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ height: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--text)" }}>
        <div className="card" style={{ display: "grid", gap: "var(--sp-3)", justifyItems: "center", maxWidth: 360, textAlign: "center" }}>
          <Icon name="warning" size={22} style={{ color: "var(--danger)" }} />
          <div style={{ fontWeight: 600 }}>No se pudo abrir el diagrama</div>
          <div className="text-muted" style={{ fontSize: 13 }}>{err}</div>
          <button className="btn btn-primary" onClick={() => nav("/")}>Volver a mis diagramas</button>
        </div>
      </div>
    );
  }

  if (!diagram) return null;

  const handleUpdateRelation = async (patch) => {
    try {
      await updateRelation(selectedRel.id, patch);
    } catch {
      alert("No se pudo actualizar la relación");
    }
  };

  const handleDeleteRelation = async () => {
    try {
      await deleteRelation(selectedRel.id);
      setSelectedRelId(null);
    } catch {
      alert("No se pudo eliminar la relación");
    }
  };

  // =====================================================
  // Render
  // =====================================================
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "var(--header-h) 1fr",
        height: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        overflow: "hidden",
      }}
    >
      <HeaderBar
        diagram={diagram}
        email={email}
        theme={theme}
        toggleTheme={toggleTheme}
        insertMode={insertMode}
        setInsertMode={setInsertMode}
        onBack={() => nav("/")}
        onLogout={() => { logout(); nav("/login", { replace: true }); }}
        onExport={() => exportDiagram(diagram.id)}
        exporting={exporting}
        onOpenHelp={() => setShowHelp(true)}
      />

      <div style={{ display: "flex", minHeight: 0 }}>
        <LeftPanel
          classes={classes}
          relations={relations}
          selectedId={selectedId}
          selectedRelId={selectedRelId}
          onSelectClass={(cid) => { setSelectedId(cid); setSelectedRelId(null); }}
          onSelectRelation={(rid) => { setSelectedRelId(rid); setSelectedId(null); }}
        />

        {/* ---------------- Lienzo ---------------- */}
        <main style={{ position: "relative", flex: 1, minWidth: 0 }}>
          {/* Instrucción del modo insertar */}
          {insertMode && (
            <div
              style={{
                position: "absolute",
                top: "var(--sp-4)",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 15,
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-3)",
                padding: "var(--sp-2) var(--sp-3)",
                borderRadius: "var(--radius)",
                background: "var(--surface-1)",
                border: "1px solid var(--accent)",
                boxShadow: "var(--shadow)",
              }}
            >
              <Icon name="info" size={15} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 13 }}>Escribí el nombre y hacé clic en el lienzo:</span>
              <input
                className="input input-sm"
                style={{ width: 150 }}
                value={insertName}
                onChange={(e) => setInsertName(e.target.value)}
                placeholder="Ej: Cliente"
                autoFocus
              />
              <button className="btn btn-sm" onClick={() => setInsertMode(false)}>
                Cancelar
              </button>
            </div>
          )}

          {/* Estado vacío: qué hacer cuando el diagrama recién arranca */}
          {classes.length === 0 && !insertMode && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                pointerEvents: "none",
                zIndex: 5,
              }}
            >
              <div
                className="panel"
                style={{
                  pointerEvents: "auto",
                  padding: "var(--sp-5)",
                  maxWidth: 380,
                  textAlign: "center",
                  display: "grid",
                  gap: "var(--sp-3)",
                  justifyItems: "center",
                  boxShadow: "var(--shadow)",
                }}
              >
                <div
                  style={{
                    width: 44, height: 44, display: "grid", placeItems: "center",
                    borderRadius: "var(--radius)", background: "var(--accent-soft)", color: "var(--accent)",
                  }}
                >
                  <Icon name="class" size={20} />
                </div>
                <div style={{ fontWeight: 600 }}>Este diagrama está vacío</div>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  Empezá creando tu primera clase. Podés hacerlo vos mismo o pedírselo
                  al asistente escribiendo o hablando.
                </div>
                <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                  <button className="btn btn-primary" onClick={() => setInsertMode(true)}>
                    <Icon name="plus" />
                    Crear una clase
                  </button>
                  <button className="btn" onClick={() => setShowHelp(true)}>
                    <Icon name="help" />
                    Ver la guía
                  </button>
                </div>
              </div>
            </div>
          )}

          <Sheet onCanvasClick={handleCanvasClick} onCameraChange={setCamera}>
            {classes.map((c) => (
              <ClassCard
                key={c.id}
                cls={c}
                selected={c.id === selectedId}
                onSelect={(cid) => { setSelectedId(cid); setSelectedRelId(null); }}
                onDragEnd={handleDragEnd}
                onResizeEnd={handleResizeEnd}
                details={detailsByClass[c.id]}
                alwaysShowDetails={true}
                showLinkPortsOnHover={true}
                forceShowPorts={!!linking && c.id !== linking?.fromId}
                onStartLink={(fromId, side, pt) => setLinking({ fromId, fromSide: side, cursor: pt })}
              />
            ))}
          </Sheet>

          <ConnectionLayer
            classes={classes}
            tempLink={linking ? { fromId: linking.fromId, fromSide: linking.fromSide, cursor: linking.cursor } : null}
            relations={relations}
            camera={camera}
            onSelectRelation={(rid) => { setSelectedRelId(rid); setSelectedId(null); }}
          />

          <AiAssistantPanel diagramId={diagram.id} />
        </main>

        {/* ---------------- Panel derecho ---------------- */}
        {selectedRel ? (
          <RelationInspector
            relation={selectedRel}
            onUpdate={handleUpdateRelation}
            onDelete={handleDeleteRelation}
          />
        ) : (
          <Inspector
            selected={selected}
            details={selected ? detailsByClass[selected.id] : undefined}
            reloadDetails={() => selected && fetchDetails(selected.id)}
            onDeleteClass={() => selected && handleDelete(selected.id)}
            onAddAttr={(cid) => addAttr(cid)}
            onPatchAttr={(cid, aid, patch) => patchAttr(cid, aid, patch)}
            onRemoveAttr={(cid, aid) => removeAttr(cid, aid)}
            onAddMeth={(cid) => addMeth(cid)}
            onPatchMeth={(cid, mid, patch) => patchMeth(cid, mid, patch)}
            onRemoveMeth={(cid, mid) => removeMeth(cid, mid)}
          />
        )}
      </div>

      {showHelp && <HelpGuide onClose={closeHelp} />}
    </div>
  );
}
