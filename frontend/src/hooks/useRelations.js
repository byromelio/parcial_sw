
// // src/hooks/useRelations.js
import { useEffect, useState } from "react";
import {
  listRelations,
  getRelation,                // 👈 importa esta
  createRelation as apiCreateRelation,
  updateRelation as apiUpdateRelation,
  deleteRelation as apiDeleteRelation,
} from "../api/relations";
import { onEvent } from "../api/realtime";

export default function useRelations(diagram) {
  const [relations, setRelations] = useState([]);
  const [selectedRelId, setSelectedRelId] = useState(null);
  const [selectedRelation, setSelectedRelation] = useState(null); // 👈 ya no usamos solo find()

  // ====== CARGA INICIAL ======
  async function loadRelations() {
    if (!diagram?.id) return;
    try {
      const items = await listRelations(diagram.id);
      setRelations(items || []);
      if (selectedRelId && !items?.some((x) => x.id === selectedRelId)) {
        setSelectedRelId(null);
        setSelectedRelation(null);
      }
    } catch {
      setRelations([]);
    }
  }

  useEffect(() => {
    if (diagram) loadRelations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram]);

  // ====== FETCH RELACIÓN SELECCIONADA ======
  useEffect(() => {
    if (!selectedRelId) {
      setSelectedRelation(null);
      return;
    }
    (async () => {
      try {
        const rel = await getRelation(selectedRelId); // 👈 ahora traes la data fresca
        setSelectedRelation(rel);
      } catch {
        setSelectedRelation(null);
      }
    })();
  }, [selectedRelId]);

  // ====== CRUD ======
  async function createRelation(body) {
    return await apiCreateRelation(diagram.id, body);
  }

  async function updateRelation(relationId, patch) {
    return await apiUpdateRelation(relationId, patch);
  }

  async function deleteRelation(relationId) {
    if (!confirm("¿Eliminar esta relación?")) return;
    return await apiDeleteRelation(relationId);
  }

  // ====== EVENTOS EN TIEMPO REAL ======
  useEffect(() => {
    if (!diagram?.id) return;

    // crear
    onEvent("relation.created", (rel) => {
      if (rel.diagram_id === diagram.id) {
        setRelations((prev) => [...prev, rel]);
      }
    });

    // actualizar
    onEvent("relation.updated", (rel) => {
      if (rel.diagram_id === diagram.id) {
        setRelations((prev) =>
          prev.map((r) => (r.id === rel.id ? { ...r, ...rel } : r))
        );
        if (selectedRelId === rel.id) {
          setSelectedRelation(rel); // 👈 actualiza también el detalle abierto
        }
      }
    });

    // eliminar
    onEvent("relation.deleted", ({ id, diagram_id }) => {
      if (diagram_id === diagram.id) {
        setRelations((prev) => prev.filter((r) => r.id !== id));
        if (selectedRelId === id) {
          setSelectedRelId(null);
          setSelectedRelation(null);
        }
      }
    });
  }, [diagram, selectedRelId]);

  return {
    relations,
    selectedRelId,
    setSelectedRelId,
    selectedRelation,   // 👈 ahora viene desde getRelation
    loadRelations,
    createRelation,
    updateRelation,
    deleteRelation,
  };
}
