"use client";

import { useEffect, useState } from "react";

export default function RunPipelineButton({ batchId }: { batchId: string }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("IDLE");
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function start() {
    try {
      setError(null);
      setStatus("RUNNING");
      setProgress(0);
      setMessage("starting...");

      if (!batchId) throw new Error("batchId ist leer/undefined");

      const res = await fetch(`/api/imports/${batchId}/run`, { method: "POST" });
      const text = await res.text();

      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`API hat kein JSON zurückgegeben (HTTP ${res.status}): ${text.slice(0, 140)}`);
      }

      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      setJobId(data.jobId);
      setMessage("job started");
    } catch (e: any) {
      setStatus("ERROR");
      setError(e?.message ?? "unknown error");
    }
  }

  useEffect(() => {
    if (!jobId) return;

    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const text = await res.text();
        const data = JSON.parse(text);
        if (!data.ok) return;

        const job = data.job;
        setStatus(job.status);
        setProgress(job.progress ?? 0);
        setMessage(job.message ?? "");

        if (job.status === "FINISHED" || job.status === "ERROR") clearInterval(t);
      } catch {
        // polling errors ignorieren
      }
    }, 800);

    return () => clearInterval(t);
  }, [jobId]);

  return (
    <div style={{ marginTop: 12, border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
      <button
        onClick={start}
        disabled={status === "RUNNING"}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #2a2a2a",
          background: status === "RUNNING" ? "#1a1a1a" : "#0f0f0f",
          color: "#fff",
          cursor: status === "RUNNING" ? "not-allowed" : "pointer",
          fontWeight: 700,
        }}
      >
        Pipeline starten (processBatch → rollups)
      </button>

      <div style={{ marginTop: 8, color: "#bdbdbd", fontSize: 13 }}>
        Status: <b style={{ color: "#fff" }}>{status}</b> · Progress: <b style={{ color: "#fff" }}>{progress}%</b> · {message}
      </div>

      {error ? <div style={{ marginTop: 8, color: "#ff6b6b", fontSize: 13 }}>❌ {error}</div> : null}

      <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
        Debug batchId: <span style={{ fontFamily: "monospace" }}>{String(batchId)}</span>
      </div>
    </div>
  );
}