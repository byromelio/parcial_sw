// src/hooks/useMethods.js
import { useEffect, useState } from "react";
import {
  listMethods,
  createMethod as apiCreateMethod,
  updateMethod as apiUpdateMethod,
  deleteMethod as apiDeleteMethod,
} from "../api/classes";

export default function useMethods(classId) {
  const [methods, setMethods] = useState([]);
  const [selectedMethodId, setSelectedMethodId] = useState(null);

  const selectedMethod =
    methods.find((m) => m.id === selectedMethodId) || null;

  async function loadMethods() {
    if (!classId) return;
    try {
      const items = await listMethods(classId);
      setMethods(items || []);
      if (selectedMethodId && !items?.some((x) => x.id === selectedMethodId)) {
        setSelectedMethodId(null);
      }
    } catch {
      setMethods([]);
    }
  }

  useEffect(() => {
    if (classId) loadMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function createMethod(body) {
    return await apiCreateMethod(classId, body);
  }

  async function updateMethod(methodId, patch) {
    return await apiUpdateMethod(methodId, patch);
  }

  async function deleteMethod(methodId) {
    if (!confirm("¿Eliminar este método?")) return;
    return await apiDeleteMethod(methodId);
  }

  return {
    methods,
    selectedMethodId,
    setSelectedMethodId,
    selectedMethod,

    loadMethods,
    createMethod,
    updateMethod,
    deleteMethod,
  };
}
