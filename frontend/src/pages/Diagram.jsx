// frontend/src/pages/Diagram.jsx

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// ===== API endpoints (backend REST) =====
// import { listRelations, createRelation } from "../api/relations";
// import { updateRelation, deleteRelation } from "../api/relations";

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

// ===== layout =====
import HeaderBar from "../components/layout/HeaderBar";
import LeftPanel from "../components/layout/LeftPanel";


// =====================================================
// 🔹 Componente principal: Dashboard de diagramas UML
// =====================================================
export default function DiagramDashboard() {
  const { id } = useParams();       // Obtiene el diagramId desde la URL
  const nav = useNavigate();

  // 🔐 Estado global de autenticación
  const logout = useAuth((s) => s.logout);
  const email = useAuth((s) => s.email);

  // 🎨 Tema claro/oscuro
  const { theme, toggleTheme } = useTheme();

  // 📄 Hook que carga los datos del diagrama actual
  const { diagram, loading, err } = useDiagram(id);

  // 🔗 Relaciones entre clases
  // const [relations, setRelations] = useState([]);
  const [linking, setLinking] = useState(null); // si el usuario está creando relación
  const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 }); // zoom/pan del canvas
const { exportDiagram, loading: exporting } = useExportDiagram();
  // 🎯 Selección actual (relación/clase)
  // const [selectedRelId, setSelectedRelId] = useState(null);
  // const selectedRel = relations.find(r => r.id === selectedRelId) || null;
  const {
    relations,
    selectedRelId, setSelectedRelId,
    selectedRelation: selectedRel,
    createRelation, updateRelation, deleteRelation
  } = useRelations(diagram);
  // const [setRelations] = useState([]);

  // 📦 Hook centralizado para manejar clases y detalles
  const {
    classes, setClasses,
    selectedId, setSelectedId, selected,
    detailsByClass, replaceDetails,
    insertMode, setInsertMode,
    insertName, setInsertName,
    loadClasses, fetchDetails,
    handleCanvasClick,
    debouncedSave, onBlurName,
    handleDragEnd, handleResizeEnd,
    handleDelete,
    // 🔹 Atributos
    addAttr, patchAttr, removeAttr,
    // 🔹 Métodos
    addMeth, patchMeth, removeMeth,
  } = useClassesAndDetails(diagram);

  // =====================================================
  // 🔹 Manejar "linking" (cuando el usuario conecta clases)
  // =====================================================
  useEffect(() => {
    if (!linking) return;

    // Detecta si el mouse está sobre una clase (DOM → dataset)
    const hitTestByDom = (pt) => {
      const stack = document.elementsFromPoint(pt.x, pt.y) || [];
      const el = stack.find((n) => n?.getAttribute && n.getAttribute("data-class-id"));
      if (el) {
        return el.getAttribute("data-class-id") || null;
      }
      return null;
    };

    // Mientras se mueve el mouse, actualiza cursor
    const onMove = (e) => {
      setLinking((prev) => prev ? { ...prev, cursor: { x: e.clientX, y: e.clientY } } : prev);
    };

    // Al soltar el mouse → intenta crear relación
    const onUp = async (e) => {
      const pt = { x: e.clientX, y: e.clientY };
      let toId = hitTestByDom(pt) || hitTestClasses(pt, classes);

      // if (toId && toId !== linking.fromId) {
      if (toId) { //permite dibujar recursiva mas
        const dstSide = inferClosestSide(toId, pt);
        try {
          // const r = await createRelation(diagram.id, {
          //   from_class: linking.fromId,
          //   to_class: toId,
          //   type: "ASSOCIATION", // tipo por defecto
          //   src_anchor: linking.fromSide,
          //   dst_anchor: dstSide,
          // });
          // setRelations((prev) => [...prev, r]);
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

    // Suscribir listeners globales
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);

    return () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
    };
  }, [linking, classes, diagram?.id]);


  // =====================================================
  // 🔹 Manejo de estados de carga y errores
  // =====================================================
  if (loading) return <div style={{ padding: 16 }}>Cargando…</div>;
  if (err) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 8, color: "salmon" }}>{err}</div>
        <button onClick={() => nav("/")} style={{ padding: "6px 10px" }}>
          Volver
        </button>
      </div>
    );
  }
  if (!diagram) return null;


  // =====================================================
  // 🔹 Handlers para actualizar / eliminar relaciones
  // =====================================================
  const handleUpdateRelation = async (patch) => {
    try {
      const updated = await updateRelation(selectedRel.id, patch);
      //   setRelations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      //
    } catch {
      alert("No se pudo actualizar la relación");
    }
  };

  const handleDeleteRelation = async () => {
    if (!window.confirm("¿Eliminar esta relación?")) return;
    try {
      await deleteRelation(selectedRel.id);
      // setRelations((prev) => prev.filter((r) => r.id !== selectedRel.id));
      setSelectedRelId(null);
    } catch {
      alert("No se pudo eliminar la relación");
    }
  };


  // =====================================================
  // 🔹 Render principal (UI)
  // =====================================================
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "64px 1fr",   // header arriba, resto abajo
        height: "100vh",
        background: "var(--bg, #0b1020)",
        color: "var(--text, #eaeefb)",
      }}
    >
      {/* Barra superior con acciones */}
      <HeaderBar
        diagram={diagram}
        email={email}
        theme={theme}
        toggleTheme={toggleTheme}
        insertName={insertName}
        setInsertName={setInsertName}
        insertMode={insertMode}
        setInsertMode={setInsertMode}
        onBack={() => nav("/")}
        onLogout={() => { logout(); nav("/login", { replace: true }); }}
          onExport={() => exportDiagram(diagram.id)}   // 👈 pasamos handler
  exporting={exporting}  
    />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "100px 1fr minmax(300px, 420px)", // panel izq controla el tamaño
          height: "100%",
        }}
      >
        {/* Panel lateral izquierdo */}
        <LeftPanel />

        {/* Área central: canvas con clases y relaciones */}
        <main style={{ position: "relative" }}>
          <Sheet onCanvasClick={handleCanvasClick} onCameraChange={setCamera}>
            {classes.map((c) => (
              <ClassCard
                key={c.id}
                cls={c}
                selected={c.id === selectedId}
                onSelect={(id) => { setSelectedId(id); setSelectedRelId(null); }}
                onDragEnd={handleDragEnd}
                onResizeEnd={handleResizeEnd}
                details={detailsByClass[c.id]}
                alwaysShowDetails={true}
                showLinkPortsOnHover={true}
                forceShowPorts={!!linking && c.id !== linking?.fromId}
                onStartLink={(fromId, side, pt) => {
                  setLinking({ fromId, fromSide: side, cursor: pt });
                }}
              />
            ))}
          </Sheet>

          {/* Capa de conexiones entre clases */}
          <ConnectionLayer
            classes={classes}
            tempLink={linking ? {
              fromId: linking.fromId,
              fromSide: linking.fromSide,
              cursor: linking.cursor,
            } : null
            }
            relations={relations}
            camera={camera}
            onSelectRelation={(id) => { setSelectedRelId(id); setSelectedId(null); }}
          />
        </main>

        {/* Panel lateral derecho: inspector de clase o relación */}
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
            onRename={(name) => selected && handleRename(selected.id, name)}
            onDetailsChange={(patch) => selected && replaceDetails(selected.id, patch)}
            reloadDetails={() => selected && fetchDetails(selected.id)}
            onDeleteClass={() => selected && handleDelete(selected.id)}

            // 🔹 nuevas props (vienen del hook)
            onAddAttr={(cid) => addAttr(cid)}
            onPatchAttr={(cid, aid, patch) => patchAttr(cid, aid, patch)}
            onRemoveAttr={(cid, aid) => removeAttr(cid, aid)}
            onAddMeth={(cid) => addMeth(cid)}
            onPatchMeth={(cid, mid, patch) => patchMeth(cid, mid, patch)}
            onRemoveMeth={(cid, mid) => removeMeth(cid, mid)}
          />

        )}
      </div>
    </div>
  );
}
