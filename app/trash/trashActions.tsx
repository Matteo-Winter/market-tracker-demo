"use client";

import { useRouter } from "next/navigation";

function btn() {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    background: "#121212",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800 as const,
  };
}

function danger() {
  return {
    ...btn(),
    border: "1px solid #5a1a1a",
    background: "#2a0f0f",
    color: "#ffb4b4",
  };
}

async function callApi(url: string, confirmText: string) {
  if (!confirm(confirmText)) return;

  const res = await fetch(url, { method: "POST" });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Fehler (${res.status}): ${text}`);
  }

  // JSON optional
  try {
    const j = JSON.parse(text);
    if (j?.ok === false) throw new Error(j.error ?? "unknown");
  } catch {
    // ignore
  }
}

export default function TrashActions({ type, id }: { type: "main" | "run"; id: string }) {
  const router = useRouter();

  const restoreUrl =
    type === "main"
      ? `/api/main/by-id/${id}/restore`
      : `/api/runs/by-id/${id}/restore`;

  const purgeUrl =
    type === "main"
      ? `/api/main/by-id/${id}/purge`
      : `/api/runs/by-id/${id}/purge`;

  return (
    <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button
        style={btn()}
        onClick={async () => {
          try {
            await callApi(restoreUrl, "Wirklich wiederherstellen?");
            router.refresh();
          } catch (e: any) {
            alert(e.message);
          }
        }}
      >
        Wiederherstellen
      </button>

      <button
        style={danger()}
        onClick={async () => {
          try {
            await callApi(purgeUrl, "FINAL löschen? (nicht rückgängig)");
            router.refresh();
          } catch (e: any) {
            alert(e.message);
          }
        }}
      >
        Final löschen
      </button>
    </div>
  );
}