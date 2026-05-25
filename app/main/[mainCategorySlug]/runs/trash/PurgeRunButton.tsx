"use client";

export default function PurgeRunButton({ runId }: { runId: string }) {
  return (
    <button
      onClick={async () => {
        const ok = confirm("FINAL löschen? (nicht rückgängig)");
        if (!ok) return;
        const res = await fetch(`/api/runs/${runId}/purge`, { method: "POST" });
        const j = await res.json().catch(() => null);
        if (!res.ok) alert(`Fehler (${res.status}): ${j?.error ?? "unknown"}`);
        else location.reload();
      }}
      style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #552222", background: "#220b0b", color: "#fff", cursor: "pointer" }}
    >
      Final löschen
    </button>
  );
}