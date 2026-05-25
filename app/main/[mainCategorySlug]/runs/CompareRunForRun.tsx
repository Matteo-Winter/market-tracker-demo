"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CompareRunForRun({
  runId,
  value,
  options,
}: {
  runId: string;
  value: string;
  options?: { id: string; month: string }[];
}) {
  const router = useRouter();
  const opts = Array.isArray(options) ? options : [];

  const [cur, setCur] = useState<string>(value ?? "");
  const [msg, setMsg] = useState<string>("");

  async function save(next: string) {
    setMsg("");
    setCur(next);

    const res = await fetch(`/api/runs/${runId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ compareToRunId: next || null }),
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      setMsg(`❌ API kein JSON (HTTP ${res.status})`);
      return;
    }

    if (!res.ok || !data?.ok) {
      setMsg(`❌ ${data?.error ?? `HTTP ${res.status}`}`);
      return;
    }

    setMsg("✅ gespeichert");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ color: "#bdbdbd", fontSize: 13 }}>Vergleich:</div>

      <select
        value={cur}
        onChange={(e) => save(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #2a2a2a",
          background: "#0f0f0f",
          color: "#fff",
          minWidth: 260,
        }}
      >
        <option value="">(kein)</option>
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.month} · {o.id.slice(0, 8)}…
          </option>
        ))}
      </select>

      <div style={{ fontSize: 13, color: msg.startsWith("✅") ? "#7CFC9A" : msg ? "#ff6b6b" : "#666" }}>
        {msg || " "}
      </div>
    </div>
  );
}