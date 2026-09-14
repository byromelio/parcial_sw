// src/hooks/useAttributes.js
import { useEffect, useState } from "react";
import {
  listAttributes,
  createAttribute as apiCreateAttribute,
  updateAttribute as apiUpdateAttribute,
  deleteAttribute as apiDeleteAttribute,
} from "../api/classes";

export default function useAttributes(classId) {
  const [attributes, setAttributes] = useState([]);
  const [selectedAttrId, setSelectedAttrId] = useState(null);

  const selectedAttribute =
    attributes.find((a) => a.id === selectedAttrId) || null;

  async function loadAttributes() {
    if (!classId) return;
    try {
      const items = await listAttributes(classId);
      setAttributes(items || []);
      if (selectedAttrId && !items?.some((x) => x.id === selectedAttrId)) {
        setSelectedAttrId(null);
      }
    } catch {
      setAttributes([]);
    }
  }

  useEffect(() => {
    if (classId) loadAttributes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function createAttribute(body) {
    return await apiCreateAttribute(classId, body);
  }

  async function updateAttribute(attrId, patch) {
    return await apiUpdateAttribute(attrId, patch);
  }

  async function deleteAttribute(attrId) {
    if (!confirm("¿Eliminar este atributo?")) return;
    return await apiDeleteAttribute(attrId);
  }

  return {
    attributes,
    selectedAttrId,
    setSelectedAttrId,
    selectedAttribute,

    loadAttributes,
    createAttribute,
    updateAttribute,
    deleteAttribute,
  };
}
