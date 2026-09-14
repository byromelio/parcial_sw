import { useEffect, useState } from "react";
import api from "../../api/client";

export default function ApiStatusBadge() {
  const [ok, setOk] = useState(null);

  useEffect(() => {
    let mounted = true;
    api.get("/health")
      .then(() => mounted && setOk(true))
      .catch(() => mounted && setOk(false));
    return () => { mounted = false; };
  }, []);

  const color = ok === null ? "#999" : ok ? "green" : "crimson";
  const text = ok === null ? "checking…" : ok ? "API OK" : "API OFF";

  return (
    <span style={{
      padding: "4px 8px",
      borderRadius: 8,
      background: color,
      color: "white",
      fontSize: 12,
      marginLeft: 8
    }}>
      {text}
    </span>
  );
}
