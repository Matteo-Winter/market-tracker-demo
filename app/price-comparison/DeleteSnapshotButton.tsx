"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  snapshotId: string;
  snapshotLabel: string;
};

export default function DeleteSnapshotButton({ snapshotId, snapshotLabel }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const token = window.prompt("ADMIN_TOKEN eingeben");
    if (!token) return;

    const confirmed = window.confirm(`Snapshot wirklich löschen?\n\n${snapshotLabel}`);
    if (!confirmed) return;

    setBusy(true);
    try {
      const body = new FormData();
      body.set("token", token);

      const res = await fetch(`/api/price-comparison/snapshots/${snapshotId}`, {
        method: "POST",
        body,
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : { ok: false, error: "Leere Antwort" };
      if (!json.ok) {
        window.alert(`Fehler: ${json.error ?? "Snapshot konnte nicht gelöscht werden."}`);
        return;
      }

      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Snapshot konnte nicht gelöscht werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      style={{
        borderRadius: 999,
        border: "1px solid rgba(248,113,113,0.38)",
        background: "rgba(127,29,29,0.18)",
        color: "#fecaca",
        fontSize: 11,
        fontWeight: 800,
        padding: "8px 10px",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.7 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {busy ? "Lösche…" : "Löschen"}
    </button>
  );
}
