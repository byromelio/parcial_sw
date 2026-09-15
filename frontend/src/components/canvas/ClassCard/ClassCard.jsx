 //src/components/canvas/ClassCard/ClassCard.jsx
import { useMemo, useRef } from "react";
import { SHEET } from "../Sheet";
import Header from "./Header";
import Body from "./Body";
import Ports from "./Ports";
import useDragResize from "./useDragResize";
import useAutoGrow from "./useAutoGrow";

/** Debe coincidir con HIT en Ports.jsx */
const PORT_MARGIN = 22;

/**
 * Props:
 *  - cls, details, selected, onSelect, onDragEnd, onResizeEnd
 *  - autoGrowHeight, minH, maxH, alwaysShowDetails
 *  - onStartLink(fromId, side, pt), showLinkPortsOnHover
 *  - forceShowPorts (nuevo): fuerza mostrar puertos (útil durante linking)
 */
export default function ClassCard({
  cls,
  details,
  selected = false,
  onSelect,
  onDragEnd,
  onResizeEnd,
  autoGrowHeight = true,
  minH = 4,
  maxH = 32,
  alwaysShowDetails = false,
  onStartLink,
  showLinkPortsOnHover = false,
  forceShowPorts = false, // ⬅️ nuevo
  lockedByOther = null,   // email de quien la tiene bloqueada, o null
}) {
  const { CELL } = SHEET;
  const headerRef = useRef(null);
  const bodyRef = useRef(null);

  // drag/resize
  const {
    pos, size, dragging,
    onHeaderMouseDown, onHandleMouseDown,
    setSize, setPinned,
    pinned, setHover, hover,
  } = useDragResize({
    cls, minH, maxH, CELL, onDragEnd, onResizeEnd,
  });

  const showDetails = alwaysShowDetails || pinned || selected;

  // auto grow
  useAutoGrow({
    enabled: autoGrowHeight && showDetails,
    headerRef, bodyRef, CELL, minH, maxH,
    size, setSize, onResizeEnd, clsId: cls.id,
  });

  const left = (pos.x ?? 0) * CELL;
  const top = (pos.y ?? 0) * CELL;
  const width = (size.w ?? 12) * CELL;
  const height = (size.h ?? 6) * CELL;

  const counts = useMemo(
    () => ({
      attrs: Array.isArray(details?.attrs) ? details.attrs.length : null,
      meths: Array.isArray(details?.meths) ? details.meths.length : null,
    }),
    [details]
  );
  const showCounts = !showDetails && (counts.attrs !== null || counts.meths !== null);

  // 👇 lógica final de visibilidad de puertos
  const showPorts = forceShowPorts || selected || (showLinkPortsOnHover && hover);

  return (
    <div
      data-class-id={cls.id}
      onMouseDown={() => onSelect?.(cls.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute",
        left, top, width, height,
        overflow: "visible",       // 🔑 para que los puertos puedan “salir”
        zIndex: cls.z_index ?? 1,
        cursor: dragging ? "grabbing" : lockedByOther ? "not-allowed" : "default",
      }}
      title={
        lockedByOther
          ? `La está editando ${lockedByOther}`
          : selected ? "Seleccionada" : "Click para seleccionar"
      }
    >
      {/* HALO de hover (invisible), más grande que el card para cubrir los puertos */}
      <div
        style={{
          position: "absolute",
          left: -PORT_MARGIN,
          top: -PORT_MARGIN,
          width: width + PORT_MARGIN * 2,
          height: height + PORT_MARGIN * 2,
          background: "transparent",
          pointerEvents: "auto",   // recibe eventos fuera del card
        }}
      />

      {/* Caja visual del card */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--surface-1)",
          border: lockedByOther
            ? "2px solid var(--warning)"
            : selected ? "2px solid var(--accent)" : "1px solid var(--border-strong)",
          borderRadius: "var(--radius)",
          color: "var(--text)",
          boxShadow: lockedByOther
            ? "0 0 0 3px var(--warning-soft), var(--shadow)"
            : selected ? "0 0 0 3px var(--accent-soft), var(--shadow)" : "var(--shadow-sm)",
          overflow: "hidden",
          transition: "box-shadow .15s, border-color .15s, background .15s",
        }}
      >
        <Header
          innerRef={headerRef}
          onMouseDown={lockedByOther ? undefined : onHeaderMouseDown}
          title={cls.name ?? cls.nombre ?? "Clase"}
          pinned={pinned}
          setPinned={setPinned}
          showCounts={showCounts}
          counts={counts}
          lockedByOther={lockedByOther}
        />

        <Body innerRef={bodyRef} showDetails={showDetails} details={details} size={size} />

        {/* Handle de resize */}
        <div
          onMouseDown={lockedByOther ? undefined : onHandleMouseDown}
          style={{
            position: "absolute",
            right: 2, bottom: 2,
            width: 14, height: 14,
            border: "1px solid #445",
            borderRadius: 4,
            background: "rgba(255,255,255,.06)",
            cursor: "nwse-resize",
          }}
          title="Arrastra para redimensionar"
        />
      </div>

      {/* Puertos */}
      <Ports
        visible={showPorts}
        onStartLink={(side, e) =>
          onStartLink?.(cls.id, side, { x: e.clientX, y: e.clientY })
        }
      />
    </div>
  );
}
