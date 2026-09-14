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
        padding: 8,
        fontWeight: 700,
        borderBottom: "1px solid #26314d",
        cursor: "grab",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
      title="Arrastra para mover"
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {showCounts && (
          <span style={{ fontSize: 11, opacity: 0.85 }}>
            {(counts.attrs ?? 0)} attrs · {(counts.meths ?? 0)} métodos
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPinned((v) => !v);
          }}
          title={pinned ? "Desfijar detalles" : "Fijar detalles"}
          style={{
            border: "1px solid #334",
            background: pinned ? "#334" : "transparent",
            color: "inherit",
            borderRadius: 6,
            padding: "2px 6px",
            cursor: "pointer",
          }}
        >
          {pinned ? "📌" : "📍"}
        </button>
      </div>
    </div>
  );
}
