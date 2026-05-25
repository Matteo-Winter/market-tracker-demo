"use client";

import { useEffect, useState } from "react";

export default function RecomputeLatestRunButton(props: {
  mainCategorySlug: string;
  runId: string;
}) {
  const { mainCategorySlug, runId } = props;

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

      const res = await fetch(`/api/main/${mainCategorySlug}/edit-tree/recompute-latest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });

      const text = await res.text();
      const data = JSON.parse(text);

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
        // ignore
      }
    }, 800);

    return () => clearInterval(t);
  }, [jobId]);

  return (
    <div style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
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
          fontWeight: 800,
        }}
      >
        Rollups neu berechnen (aktuellster Run)
      </button>

      <div style={{ marginTop: 8, color: "#bdbdbd", fontSize: 13 }}>
        Status: <b style={{ color: "#fff" }}>{status}</b> · Progress: <b style={{ color: "#fff" }}>{progress}%</b> · {message}
      </div>

      {error ? <div style={{ marginTop: 8, color: "#ff6b6b", fontSize: 13 }}>❌ {error}</div> : null}
    </div>
  );
}