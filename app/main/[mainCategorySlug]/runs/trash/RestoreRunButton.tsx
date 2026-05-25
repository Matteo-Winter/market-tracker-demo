"use client";

export default function RestoreRunButton({ runId }: { runId: string }) {
  return (
    <button
      onClick={async () => {
        const ok = confirm("Run wiederherstellen?");
        if (!ok) return;
        const res = await fetch(`/api/runs/${runId}/restore`, { method: "POST" });
        const j = await res.json().catch(() => null);
        if (!res.ok) alert(`Fehler (${res.status}): ${j?.error ?? "unknown"}`);
        else location.reload();
      }}
      style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #2a2a2a", background: "#0f0f0f", color: "#fff", cursor: "pointer" }}
    >
      Wiederherstellen
    </button>
  );
}