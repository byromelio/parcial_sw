
export default function Body({ innerRef, showDetails, details, size }) {
  return (
    <div
      ref={innerRef}
      style={{ padding: 8, fontSize: 12, lineHeight: 1.3, height: "auto", overflow: "hidden" }}
    >
      {showDetails ? (
        !details ? (
          <div style={{ opacity: 0.8 }}>Cargando detalles…</div>
        ) : (
          <>
            <div style={{ marginBottom: 6, fontWeight: 600, opacity: 0.9 }}>Atributos</div>
            {details.attrs.length === 0 ? (
              <div style={{ opacity: 0.7, marginBottom: 8 }}>—</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 16, marginBottom: 8 }}>
                {details.attrs.map((a) => (
                  <li
                    key={a.id}
                    style={{ margin: "2px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    <span style={{ opacity: 0.95 }}>{a.name ?? a.nombre}</span>
                    <span style={{ opacity: 0.7 }}> : {a.type ?? a.tipo ?? "string"}</span>
                    {a.required ? <span style={{ opacity: 0.9, marginLeft: 6 }}>*</span> : null}
                  </li>
                ))}
              </ul>
            )}

            <div style={{ marginBottom: 6, fontWeight: 600, opacity: 0.9 }}>Métodos</div>
            {details.meths.length === 0 ? (
              <div style={{ opacity: 0.7 }}>—</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {details.meths.map((m) => (
                  <li
                    key={m.id}
                    style={{ margin: "2px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    <span style={{ opacity: 0.95 }}>{m.name}</span>
                    <span style={{ opacity: 0.7 }}> : {m.return_type ?? "void"}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      ) : (
        <div style={{ opacity: 0.75 }}>
          {size.w}×{size.h} celdas
        </div>
      )}
    </div>
  );
}
