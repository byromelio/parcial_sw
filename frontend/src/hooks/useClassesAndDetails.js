
// src/hooks/useClassesAndDetails.js
import { useEffect, useState } from "react";
import {
  listClasses,
  createClass as apiCreateClass,
  updateClass,
  deleteClass as apiDeleteClass,
  updateClassPosition,
  updateClassSize,
  listAttributes,
  listMethods,
  createAttribute,   // ✅ IMPORTAR
  updateAttribute,   // ✅ IMPORTAR
  deleteAttribute,   // ✅ IMPORTAR
  createMethod,      // ✅ IMPORTAR
  updateMethod,      // ✅ IMPORTAR
  deleteMethod,      // ✅ IMPORTAR
} from "../api/classes";
import useDebouncedCallback from "./useDebouncedCallback";
import { connect, disconnect, onEvent as subscribe } from "../api/realtime";

export default function useClassesAndDetails(diagram) {
  // 🔹 Lista de clases
  const [classes, setClasses] = useState([]);

  // 🔹 Clase seleccionada
  const [selectedId, setSelectedId] = useState(null);
  const selected = classes.find((c) => c.id === selectedId) || null;

  // 🔹 Cache de atributos/métodos por clase
  const [detailsByClass, setDetailsByClass] = useState({});

  // 🔹 Estados de inserción
  const [insertMode, setInsertMode] = useState(false);
  const [insertName, setInsertName] = useState("NuevaClase");

  // ====== CARGA DE DETALLES ======
  const fetchDetails = async (classId) => {
    if (!classId) return;
    try {
      const [a, m] = await Promise.all([listAttributes(classId), listMethods(classId)]);
      setDetailsByClass((prev) => ({ ...prev, [classId]: { attrs: a || [], meths: m || [] } }));
    } catch {
      setDetailsByClass((prev) => ({ ...prev, [classId]: { attrs: [], meths: [] } }));
    }
  };

  // ====== CARGA DE CLASES ======
  async function loadClasses() {
    try {
      const items = await listClasses(diagram?.id);
      setClasses(items || []);
      if (selectedId && !items?.some((x) => x.id === selectedId)) setSelectedId(null);

      await Promise.all(
        (items || []).map((c) =>
          detailsByClass[c.id] ? Promise.resolve() : fetchDetails(c.id)
        )
      );
    } catch {
      setClasses([]);
      setSelectedId(null);
    }
  }

  // // ====== Helpers ======
  // function replaceDetails(classId, patch) {
  //   setDetailsByClass((prev) => ({
  //     ...prev,
  //     [classId]: { ...(prev[classId] || { attrs: [], meths: [] }), ...patch },
  //   }));
  // }
  // ====== EFECTO PRINCIPAL ======
  useEffect(() => {
    if (diagram) {
      loadClasses();
      connect(diagram.id);

      // Los listeners persisten hasta que uno se da de baja, asi que hay que
      // guardar cada baja y ejecutarlas en el cleanup: si no, cada vez que
      // se re-ejecuta este efecto se acumulan duplicados y un mismo evento
      // entrante se aplicaria varias veces al estado.
      const offs = [];
      const onEvent = (event, cb) => offs.push(subscribe(event, cb));

      onEvent("class.created", (c) => {
        // El que creó la clase también recibe su propio broadcast, así que
        // hay que ignorarla si ya está en la lista.
        setClasses((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]));
        setDetailsByClass((prev) =>
          prev[c.id] ? prev : { ...prev, [c.id]: { attrs: [], meths: [] } }
        );
      });

      // onEvent("class.updated", (c) => {
      //   setClasses((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...c } : x)));

      // });
      onEvent("class.updated", (c) => {
        const normalized = {
          ...c,
          name: c.name ?? c.nombre, // 👈 si viene "nombre", lo copiamos a "name"
        };

        setClasses((prev) =>
          prev.map((x) => (x.id === normalized.id ? { ...x, ...normalized } : x))
        );
      });


      onEvent("class.deleted", ({ id }) => {
        setClasses((prev) => prev.filter((x) => x.id !== id));
        setDetailsByClass((prev) => {
          const n = { ...prev };
          delete n[id];
          return n;
        });
        if (selectedId === id) setSelectedId(null);
      });
      // ====== Eventos de atributos ======
      // onEvent("attribute.created", (a) => {
      //   console.log("📩 WS atributo creado:", a);
      //   replaceDetails(a.clase_id || a.class_id, {
      //     attrs: [a, ...(detailsByClass[a.clase_id || a.class_id]?.attrs || [])],
      //   });
      // });
      // // ✅ CREAR
      // onEvent("attribute.created", (a) => {
      //   console.log("📩 WS atributo creado:", a);
      //   setDetailsByClass((prev) => {
      //     const current = prev[a.clase_id]?.attrs || [];
      //     return {
      //       ...prev,
      //       [a.clase_id]: {
      //         ...(prev[a.clase_id] || { attrs: [], meths: [] }),
      //         attrs: [...current, a], // acumula
      //       },
      //     };
      //   });
      // });

      // // ✅ ACTUALIZAR
      // onEvent("attribute.updated", (a) => {
      //   console.log("✏️ WS atributo actualizado:", a);
      //   setDetailsByClass((prev) => {
      //     const next = (prev[a.clase_id]?.attrs || []).map((x) =>
      //       x.id === a.id ? a : x
      //     );
      //     return {
      //       ...prev,
      //       [a.clase_id]: {
      //         ...(prev[a.clase_id] || { attrs: [], meths: [] }),
      //         attrs: next,
      //       },
      //     };
      //   });
      // });

      // // ✅ ELIMINAR
      // onEvent("attribute.deleted", ({ id, clase_id }) => {
      //   console.log("🗑️ WS atributo eliminado:", id);
      //   setDetailsByClass((prev) => {
      //     const next = (prev[clase_id]?.attrs || []).filter((x) => x.id !== id);
      //     return {
      //       ...prev,
      //       [clase_id]: {
      //         ...(prev[clase_id] || { attrs: [], meths: [] }),
      //         attrs: next,
      //       },
      //     };
      //   });
      // });
      function normalizeAttr(a) {
        return {
          ...a,
          name: a.name ?? a.nombre,
          type: a.type ?? a.tipo,
          required: a.required ?? a.requerido,
        };
      }

      // ✅ CREAR
      onEvent("attribute.created", (a) => {
        const attr = normalizeAttr(a);
        setDetailsByClass((prev) => {
          const current = prev[attr.clase_id]?.attrs || [];
          if (current.some((x) => x.id === attr.id)) return prev; // ya lo teníamos
          return {
            ...prev,
            [attr.clase_id]: {
              ...(prev[attr.clase_id] || { attrs: [], meths: [] }),
              attrs: [...current, attr],
            },
          };
        });
      });

      // ✅ ACTUALIZAR
      onEvent("attribute.updated", (a) => {
        const attr = normalizeAttr(a);
        console.log("✏️ WS atributo actualizado:", attr);
        setDetailsByClass((prev) => {
          const next = (prev[attr.clase_id]?.attrs || []).map((x) =>
            x.id === attr.id ? attr : x
          );
          return {
            ...prev,
            [attr.clase_id]: {
              ...(prev[attr.clase_id] || { attrs: [], meths: [] }),
              attrs: next,
            },
          };
        });
      });

      // ✅ ELIMINAR
      onEvent("attribute.deleted", ({ id, clase_id }) => {
        console.log("🗑️ WS atributo eliminado:", id);
        setDetailsByClass((prev) => {
          const next = (prev[clase_id]?.attrs || []).filter((x) => x.id !== id);
          return {
            ...prev,
            [clase_id]: {
              ...(prev[clase_id] || { attrs: [], meths: [] }),
              attrs: next,
            },
          };
        });
      });


      // ====== Eventos de métodos ======
      // onEvent("method.created", (m) => {
      //   console.log("📩 WS método creado:", m);
      //   replaceDetails(m.clase_id || m.class_id, {
      //     meths: [m, ...(detailsByClass[m.clase_id || m.class_id]?.meths || [])],
      //   });
      // });

      // onEvent("method.updated", (m) => {
      //   console.log("📩 WS método actualizado:", m);
      //   const next = (detailsByClass[m.clase_id || m.class_id]?.meths || [])
      //     .map((x) => (x.id === m.id ? m : x));
      //   replaceDetails(m.clase_id || m.class_id, { meths: next });
      // });

      // onEvent("method.deleted", ({ clase_id, class_id, id }) => {
      //   console.log("📩 WS método eliminado:", { clase_id, class_id, id });
      //   const cid = clase_id || class_id;
      //   const next = (detailsByClass[cid]?.meths || [])
      //     .filter((x) => x.id !== id);
      //   replaceDetails(cid, { meths: next });
      // });
      // // ✅ CREAR MÉTODO
      // onEvent("method.created", (m) => {
      //   console.log("📩 WS método creado:", m);
      //   setDetailsByClass((prev) => {
      //     const current = prev[m.clase_id]?.meths || [];
      //     return {
      //       ...prev,
      //       [m.clase_id]: {
      //         ...(prev[m.clase_id] || { attrs: [], meths: [] }),
      //         meths: [...current, m], // acumula
      //       },
      //     };
      //   });
      // });

      // // ✅ ACTUALIZAR MÉTODO
      // onEvent("method.updated", (m) => {
      //   console.log("✏️ WS método actualizado:", m);
      //   setDetailsByClass((prev) => {
      //     const next = (prev[m.clase_id]?.meths || []).map((x) =>
      //       x.id === m.id ? m : x
      //     );
      //     return {
      //       ...prev,
      //       [m.clase_id]: {
      //         ...(prev[m.clase_id] || { attrs: [], meths: [] }),
      //         meths: next,
      //       },
      //     };
      //   });
      // });

      // // ✅ ELIMINAR MÉTODO
      // onEvent("method.deleted", ({ id, clase_id }) => {
      //   console.log("🗑️ WS método eliminado:", { clase_id, id });
      //   setDetailsByClass((prev) => {
      //     const next = (prev[clase_id]?.meths || []).filter((x) => x.id !== id);
      //     return {
      //       ...prev,
      //       [clase_id]: {
      //         ...(prev[clase_id] || { attrs: [], meths: [] }),
      //         meths: next,
      //       },
      //     };
      //   });
      // });

      function normalizeMeth(m) {
        return {
          ...m,
          name: m.name ?? m.nombre,
          return_type: m.return_type ?? m.tipo_retorno,
        };
      }
      // ✅ CREAR
      onEvent("method.created", (m) => {
        const meth = normalizeMeth(m);
        setDetailsByClass((prev) => {
          const current = prev[meth.clase_id]?.meths || [];
          if (current.some((x) => x.id === meth.id)) return prev; // ya lo teníamos
          return {
            ...prev,
            [meth.clase_id]: {
              ...(prev[meth.clase_id] || { attrs: [], meths: [] }),
              meths: [...current, meth],
            },
          };
        });
      });

      // ✅ ACTUALIZAR
      onEvent("method.updated", (m) => {
        const meth = normalizeMeth(m);
        console.log("✏️ WS método actualizado:", meth);
        setDetailsByClass((prev) => {
          const next = (prev[meth.clase_id]?.meths || []).map((x) =>
            x.id === meth.id ? meth : x
          );
          return {
            ...prev,
            [meth.clase_id]: {
              ...(prev[meth.clase_id] || { attrs: [], meths: [] }),
              meths: next,
            },
          };
        });
      });

      // ✅ ELIMINAR
      onEvent("method.deleted", ({ id, clase_id }) => {
        console.log("🗑️ WS método eliminado:", id);
        setDetailsByClass((prev) => {
          const next = (prev[clase_id]?.meths || []).filter((x) => x.id !== id);
          return {
            ...prev,
            [clase_id]: {
              ...(prev[clase_id] || { attrs: [], meths: [] }),
              meths: next,
            },
          };
        });
      });




      return () => {
        offs.forEach((off) => off());
        disconnect();
      };
    }
  }, [diagram]);

  // ====== EFECTO: cargar detalles al seleccionar ======
  useEffect(() => {
    if (selectedId && !detailsByClass[selectedId]) {
      fetchDetails(selectedId);
    }
  }, [selectedId, detailsByClass]);

  // ====== Helpers ======
  function replaceDetails(classId, patch) {
    setDetailsByClass((prev) => ({
      ...prev,
      [classId]: { ...(prev[classId] || { attrs: [], meths: [] }), ...patch },
    }));
  }

  // ====== Crear clase ======
  async function handleCanvasClick({ x_grid, y_grid }) {
    if (!insertMode) return;
    try {
      const c = await apiCreateClass(diagram.id, {
        name: insertName.trim() || "NuevaClase",
        x_grid, y_grid, w_grid: 12, h_grid: 6, z_index: 1,
      });
      await loadClasses();
      setSelectedId(c.id);
      replaceDetails(c.id, { attrs: [], meths: [] });
    } catch (e) {
      alert(e?.response?.data?.detail || "No se pudo crear la clase");
    } finally {
      setInsertMode(false);
    }
  }

  // ====== RENAME ======
  const debouncedSave = useDebouncedCallback(async (classId, name) => {
    const updated = await updateClass(classId, { name });
    setClasses((prev) => prev.map((c) => (c.id === classId ? updated : c)));
  }, 600);

  async function handleRename(classId, name) {
    try {
      const updated = await updateClass(classId, { name });
      setClasses((prev) => prev.map((c) => (c.id === classId ? updated : c)));
    } catch (e) {
      alert(e?.response?.data?.detail || "No se pudo renombrar la clase");
    }
  }

  // ====== DRAG/RESIZE ======
  async function handleDragEnd(classId, { x_grid, y_grid }) {
    try {
      await updateClassPosition(classId, { x_grid, y_grid });
      setClasses((prev) => prev.map((c) => (c.id === classId ? { ...c, x_grid, y_grid } : c)));
    } catch {
      await loadClasses();
    }
  }

  async function handleResizeEnd(classId, { w_grid, h_grid }) {
    try {
      await updateClassSize(classId, { w_grid, h_grid });
      setClasses((prev) => prev.map((c) => (c.id === classId ? { ...c, w_grid, h_grid } : c)));
    } catch {
      await loadClasses();
    }
  }

  // ====== ELIMINAR CLASE ======
  async function handleDelete(classId) {
    if (!confirm("¿Eliminar esta clase?")) return;
    try {
      await apiDeleteClass(classId);
      setClasses((prev) => prev.filter((c) => c.id !== classId));
      setDetailsByClass((prev) => {
        const n = { ...prev };
        delete n[classId];
        return n;
      });
      if (selectedId === classId) setSelectedId(null);
    } catch (e) {
      alert(e?.response?.data?.detail || "No se pudo eliminar");
    }
  }

  // ====== RETORNO ======
  return {
    classes, setClasses,
    selectedId, setSelectedId,
    selected,
    detailsByClass, replaceDetails,
    insertMode, setInsertMode,
    insertName, setInsertName,
    loadClasses, fetchDetails,
    handleCanvasClick,
    debouncedSave,
    handleRename,
    handleDragEnd,
    handleResizeEnd,
    handleDelete,

    // 🔹 atributos
    addAttr: async (classId) => {
      const created = await createAttribute(classId, { name: "campo", type: "string", required: false });
      replaceDetails(classId, { attrs: [created, ...(detailsByClass[classId]?.attrs || [])] });
      return created;
    },
    patchAttr: async (classId, attrId, patch) => {
      const updated = await updateAttribute(attrId, patch);
      const next = (detailsByClass[classId]?.attrs || []).map((a) => a.id === attrId ? updated : a);
      replaceDetails(classId, { attrs: next });
      return updated;
    },
    removeAttr: async (classId, attrId) => {
      await deleteAttribute(attrId);
      const next = (detailsByClass[classId]?.attrs || []).filter((a) => a.id !== attrId);
      replaceDetails(classId, { attrs: next });
    },

    // 🔹 métodos
    addMeth: async (classId) => {
      const created = await createMethod(classId, { name: "operacion", return_type: "void" });
      replaceDetails(classId, { meths: [created, ...(detailsByClass[classId]?.meths || [])] });
      return created;
    },
    patchMeth: async (classId, methId, patch) => {
      const updated = await updateMethod(methId, patch);
      const next = (detailsByClass[classId]?.meths || []).map((m) => m.id === methId ? updated : m);
      replaceDetails(classId, { meths: next });
      return updated;
    },
    removeMeth: async (classId, methId) => {
      await deleteMethod(methId);
      const next = (detailsByClass[classId]?.meths || []).filter((m) => m.id !== methId);
      replaceDetails(classId, { meths: next });
    },
  };
}
