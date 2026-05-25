"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteRunButton({
  runId,
  backHref,
}: {
  runId: string;
  backHref: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    if (!confirm("Run wirklich löschen? (Batches bleiben erhalten, nur entkoppelt)")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/runs/${runId}/delete`, { method: "POST" });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        alert(json?.error ?? "Delete failed");
        return;
      }

      router.push(backHref);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onDelete}
      disabled={loading}
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #3a3a3a",
        background: "#1a1a1a",
        color: "#fff",
        cursor: loading ? "not-allowed" : "pointer",
      }}
    >
      {loading ? "Lösche…" : "Run löschen"}
    </button>
  );
}