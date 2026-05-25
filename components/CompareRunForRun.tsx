"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CompareRunForRun(props: {
  runHref: string; // z.B. /main/<slug>/runs/<runId>
  options: { id: string; month: string }[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [val, setVal] = useState(props.selectedId ?? "");

  function go(id: string) {
    const url = id ? `${props.runHref}?compareRunId=${encodeURIComponent(id)}` : props.runHref;
    router.push(url);
  }

  return (
    <select
      value={val}
      onChange={(e) => {
        const v = e.target.value;
        setVal(v);
        go(v);
      }}
      style={{
        padding: 8,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "#0f0f0f",
        color: "#fff",
        minWidth: 220,
      }}
    >
      <option value="">Vergleich: (kein)</option>
      {props.options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.month} · {o.id.slice(0, 8)}…
        </option>
      ))}
    </select>
  );
}