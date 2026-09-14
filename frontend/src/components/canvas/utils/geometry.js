
export function getClassRectById(classId) {
  const el = document.querySelector(`[data-class-id="${classId}"]`);
  if (!el) return null;
  return el.getBoundingClientRect();
}

/** Punto de anclaje (coords de ventana) según lado del rect. */
export function anchorFromRect(rect, side) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  switch (side) {
    case "top": return { x: cx, y: rect.top };
    case "right": return { x: rect.right, y: cy };
    case "bottom": return { x: cx, y: rect.bottom };
    case "left": return { x: rect.left, y: cy };
    default: return { x: cx, y: cy };
  }
}

/** Punto en rect (coords de ventana). */
export function pointInRect(p, rect) {
  return p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom;
}

/** Azúcar: ancla de una clase y lado. */
export function getAnchorForClassSide(classId, side) {
  const rect = getClassRectById(classId);
  if (!rect) return null;
  return anchorFromRect(rect, side);
}

/* ====== SOPORTE PARA PUERTOS QUE “SALEN” DEL CARD ====== */

const PORT_MARGIN = 22; // = HIT en Ports.jsx

/** Copia “inflada” del rect original en m px. */
export function inflateRect(rect, m = PORT_MARGIN) {
  return {
    left: rect.left - m,
    top: rect.top - m,
    right: rect.right + m,
    bottom: rect.bottom + m,
    width: rect.width + 2 * m,
    height: rect.height + 2 * m,
  };
}

/** Hit-test de clases, considerando margen para puertos. */
export function hitTestClasses(p, classes, margin = PORT_MARGIN) {
  for (const c of classes) {
    const r = getClassRectById(c.id);
    if (!r) continue;
    const R = margin ? inflateRect(r, margin) : r;
    if (pointInRect(p, R)) return c.id;
  }
  return null;
}

/** Lado más cercano usando el rect inflado (mejor con puertos). */
export function inferClosestSide(classId, p, margin = PORT_MARGIN) {
  const r0 = getClassRectById(classId);
  if (!r0) return "left";
  const r = inflateRect(r0, margin);
  const dTop = Math.abs(p.y - r.top);
  const dRight = Math.abs(p.x - r.right);
  const dBottom = Math.abs(p.y - r.bottom);
  const dLeft = Math.abs(p.x - r.left);
  const min = Math.min(dTop, dRight, dBottom, dLeft);
  if (min === dTop) return "top";
  if (min === dRight) return "right";
  if (min === dBottom) return "bottom";
  return "left";
}

/* ====== NUEVO: Selección de anclajes según tipo de relación UML ====== */
export function getAnchorsForRelation(type, fromId, toId, srcA = "right", dstA = "left") {
  switch ((type || "").toUpperCase()) {
    case "INHERITANCE":
    case "GENERALIZATION":
      // Herencia apunta al padre, conviene usar bottom → top
      return {
        a: getAnchorForClassSide(fromId, "bottom"),
        b: getAnchorForClassSide(toId, "top"),
      };
    // case "AGGREGATION":
    // case "COMPOSITION":
    //   // Rombo en el origen, flecha al destino
    //   return {
    //     a: getAnchorForClassSide(fromId, "right"),
    //     b: getAnchorForClassSide(toId, "left"),
    //   };
    case "AGGREGATION":
    case "COMPOSITION":
      // Línea desde origen → DESTINO (rombo en el destino)
      return {
        a: getAnchorForClassSide(fromId, "right"),
        b: getAnchorForClassSide(toId, "left"),
      };

    case "DEPENDENCY":
      // Línea punteada con flecha al destino
      return {
        a: getAnchorForClassSide(fromId, srcA),
        b: getAnchorForClassSide(toId, dstA),
      };
    case "ASSOCIATION":
    default:
      if (fromId === toId) {
        // 🔹 Relación recursiva
        const rect = getClassRectById(fromId);
        if (!rect) return { a: null, b: null };

        // Puntos: derecha → abajo (ejemplo)
        const a = anchorFromRect(rect, "right");
        const b = anchorFromRect(rect, "bottom");

        return { a, b, recursive: true }; // 👈 marcamos que es recursiva
      }
      // Asociación normal → lados configurables
      return {
        a: getAnchorForClassSide(fromId, srcA),
        b: getAnchorForClassSide(toId, dstA),
        recursive: false, 
      };
  }
}
