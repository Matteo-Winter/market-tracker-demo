"use client";

import { useEffect, useState } from "react";

export default function RunRefreshButton({ runId }: { runId: string }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");

  async function start() {
    setMsg("starte...");
    const res = await fetch(`/api/runs/${runId}/refresh`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setMsg(`❌ ${data?.error ?? "failed"}`);
      return;
    }
    setJobId(data.jobId);
    setMsg("läuft...");
  }

  useEffect(() => {
    if (!jobId) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json().catch(() => null);
      if (!data?.ok) return;
      setMsg(`${data.job.status} · ${data.job.progress}% · ${data.job.message ?? ""}`);
      if (data.job.status === "DONE" || data.job.status === "ERROR") clearInterval(t);
    }, 800);
    return () => clearInterval(t);
  }, [jobId]);

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={start}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #2a2a2a",
          background: "#0f0f0f",
          color: "#fff",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Reclassify + Rollups neu (alle aktiven)
      </button>
      {msg ? <div style={{ marginTop: 6, color: "#bdbdbd", fontSize: 13 }}>{msg}</div> : null}
    </div>
  );
}