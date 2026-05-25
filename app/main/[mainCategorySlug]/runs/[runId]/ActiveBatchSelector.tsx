"use client";

import { useState } from "react";

export default function ActiveBatchSelector(props: {
  runId: string;
  category2Id: string;
  activeBatchId: string;
  candidates: { id: string; status: string; createdAt: string }[];
}) {
  const { runId, category2Id, candidates } = props;
  const [value, setValue] = useState(props.activeBatchId || "");
  const [msg, setMsg] = useState("");

  async function save() {
    setMsg("saving...");
    const res = await fetch(`/api/runs/${runId}/category2/${category2Id}/active`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: value || null }),
    });
    const data = await res.json();
    if (!data.ok) {
      setMsg(`❌ ${data.error ?? "failed"}`);
      return;
    }
    setMsg("✅ gespeichert. Bitte Seite neu laden.");
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ padding: 10, borderRadius: 10, border: "1px solid #2a2a2a", background: "#0f0f0f", color: "#fff" }}
      >
        <option value="">(kein aktiver Batch)</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id.slice(0, 8)}… · {c.status} · {new Date(c.createdAt).toLocaleString("de-DE")}
          </option>
        ))}
      </select>

      <button
        onClick={save}
        style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #2a2a2a", background: "#0f0f0f", color: "#fff", fontWeight: 800 }}
      >
        Active setzen
      </button>

      <span style={{ color: "#bdbdbd", fontSize: 13 }}>{msg}</span>
    </div>
  );
}