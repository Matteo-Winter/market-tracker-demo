"use client";

import { useState } from "react";

export default function CollectedDateInput({
  runId,
  initialValue,
}: {
  runId: string;
  initialValue: string | null;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string>("");

  async function save() {
    setStatus("saving");
    setMsg("");

    try {
      const res = await fetch(`/api/runs/${runId}/collected-date`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectedDate: value }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus("err");
        setMsg(data?.error ?? `HTTP ${res.status}`);
        return;
      }

      setStatus("ok");
      setMsg("gespeichert");
      setTimeout(() => setStatus("idle"), 1200);
    } catch (e: any) {
      setStatus("err");
      setMsg(e?.message ?? "netzwerkfehler");
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <label style={{ color: "#bdbdbd", fontSize: 13 }}>Daten erhoben:</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="YYYY-MM-DD"
        style={{
          background: "#0f0f0f",
          border: "1px solid #2a2a2a",
          borderRadius: 10,
          padding: "8px 10px",
          color: "#fff",
          width: 140,
        }}
      />
      <button
        onClick={save}
        disabled={status === "saving"}
        style={{
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: 10,
          padding: "8px 10px",
          color: "#fff",
          cursor: status === "saving" ? "not-allowed" : "pointer",
        }}
      >
        Speichern
      </button>

      {status === "ok" ? <span style={{ color: "#7CFC90" }}>✅ {msg}</span> : null}
      {status === "err" ? <span style={{ color: "#ff6b6b" }}>❌ {msg}</span> : null}
    </div>
  );
}
