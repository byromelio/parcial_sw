// src/api/export.js
export async function exportDiagram(diagramId) {
  try {
    const urlApi = `${import.meta.env.VITE_API_URL}/diagrams/${diagramId}/export-download`;
    console.log("📤 Exportando diagrama:", diagramId, "=>", urlApi);

    const response = await fetch(urlApi, {
      method: "POST",
    });

    console.log("📥 Respuesta:", response.status, response.statusText);

    if (!response.ok) {
      // Intentar leer el cuerpo de la respuesta (por si el backend manda JSON con error)
      let errorMsg = "";
      try {
        const errorText = await response.text();
        errorMsg = errorText || response.statusText;
      } catch (e) {
        errorMsg = response.statusText;
      }
      throw new Error(`❌ Error al exportar (${response.status}): ${errorMsg}`);
    }

    // Convertir la respuesta a Blob
    const blob = await response.blob();
    console.log("✅ Blob recibido, tamaño:", blob.size, "bytes");

    // Crear enlace invisible y disparar la descarga
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `generated_project_${diagramId}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Liberar memoria
    window.URL.revokeObjectURL(url);
    console.log("📦 Descarga completada para:", diagramId);
  } catch (err) {
    console.error("⚠️ Error en exportDiagram:", err);
    throw err;
  }
}
