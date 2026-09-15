import Icon from "../../common/Icon";

export default function Header({
  innerRef,
  onMouseDown,
  title,
  pinned,
  setPinned,
  showCounts,
  counts,
}) {
  return (
    <div
      ref={innerRef}
      onMouseDown={onMouseDown}
      style={{
        padding: "8px 10px",
        fontWeight: 600,
        fontSize: 13,
        borderBottom: "1px solid var(--border)",
        cursor: "grab",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
      title="Arrastrá para mover esta clase"
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {showCounts && (
          <span className="text-subtle" style={{ fontSize: 11 }}>
            {counts.attrs ?? 0} attrs · {counts.meths ?? 0} métodos
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPinned((v) => !v);
          }}
          title={pinned ? "Dejar de mostrar siempre los detalles" : "Mostrar siempre los detalles"}
          style={{
            display: "grid",
            placeItems: "center",
            width: 22,
            height: 22,
            border: "1px solid var(--border)",
            background: pinned ? "var(--accent-soft)" : "transparent",
            color: pinned ? "var(--accent)" : "var(--text-subtle)",
            borderRadius: "var(--radius-sm)",
            padding: 0,
            cursor: "pointer",
          }}
        >
          <Icon name={pinned ? "eye" : "eyeOff"} size={13} />
        </button>
      </div>
    </div>
  );
}
