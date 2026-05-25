"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunComparePicker(props: {
  runId: string;
  options: { id: string; month: string }[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [val, setVal] = useState(props.selectedId ?? "");
  const [msg, setMsg] = useState("");

  async function save(newVal: string) {
    setMsg("speichern...");
    const res = await fetch(`/api/runs/${props.runId}/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compareToRunId: newVal || null }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setMsg(`❌ ${data?.error ?? "failed"}`);
      return;
    }

    setMsg("✅ gespeichert");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <select
        value={val}
        onChange={(e) => {
          const v = e.target.value;
          setVal(v);
          save(v);
        }}
        style={{
          padding: 8,
          borderRadius: 10,
          border: "1px solid #2a2a2a",
          background: "#0f0f0f",
          color: "#fff",
          minWidth: 240,
        }}
      >
        <option value="">Vergleich: (kein)</option>
        {props.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.month} · {o.id.slice(0, 8)}…
          </option>
        ))}
      </select>

      <span style={{ color: "#bdbdbd", fontSize: 13 }}>{msg}</span>
    </div>
  );
}