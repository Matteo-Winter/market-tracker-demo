"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteBatchButton({
  batchId,
  backHref,
  mode = "auto",
}: {
  batchId: string;
  backHref: string;
  mode?: "auto" | "keepMonthData" | "purgeMonthData";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    const msg =
      mode === "purgeMonthData"
        ? "Batch löschen + Month-Daten (Mappings/Rollups) IMMER löschen?"
        : "Batch wirklich löschen?";
    if (!confirm(msg)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/imports/${batchId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });

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
        background: "#2a1212",
        color: "#fff",
        cursor: loading ? "not-allowed" : "pointer",
      }}
    >
      {loading ? "Lösche…" : "Batch löschen"}
    </button>
  );
}