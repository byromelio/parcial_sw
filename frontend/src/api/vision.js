import api from "./client";

/**
 * Sube una foto de un diagrama de clases dibujado a mano y devuelve lo que
 * Gemini leyó (clases, atributos, relaciones) SIN crear nada todavía: el
 * resultado es para mostrar como vista previa editable antes de confirmar.
 */
export const detectDiagramFromImage = async (file) => {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/vision/detect", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data; // { classes, relations, warning }
};

/**
 * Crea un diagrama nuevo con la estructura ya revisada por el usuario.
 * Devuelve { diagram_id, classes_created, attributes_created,
 * relations_created, warnings }.
 */
export const applyDetectedDiagram = async ({ title, classes, relations }) => {
  const res = await api.post("/vision/apply", { title, classes, relations });
  return res.data;
};
