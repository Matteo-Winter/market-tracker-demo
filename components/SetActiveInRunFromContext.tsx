"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const KEY = "marketTracker.runContext";

export default function SetActiveInRunFromContext(props: {
  batchId: string;
  category2Id: string;
}) {
  const router = useRouter();
  const [ctx, setCtx] = useState<any>(null);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setCtx(parsed);
    } catch {}
  }, []);

  const canUse =
    ctx &&
    typeof ctx.runId === "string" &&
    typeof ctx.category2Id === "string" &&
    ctx.category2Id === props.category2Id &&
    typeof ctx.mainCategorySlug === "string";

  async function setActive() {
    if (!canUse) return;
    setMsg("speichern...");

    const res = await fetch(
      `/api/runs/${ctx.runId}/category2/${ctx.category2Id}/active`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: props.batchId }),
      }
    );

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setMsg(`❌ ${data?.error ?? "failed"}`);
      return;
    }

    setMsg("✅ Active gesetzt. Öffne Run…");
    // optional: Kontext löschen, damit es nicht hängen bleibt
    try { sessionStorage.removeItem(KEY); } catch {}

    router.push(`/main/${ctx.mainCategorySlug}/runs/${ctx.runId}`);
  }

  if (!canUse) return null;

  return (
    <div style={{ marginTop: 12, border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
      <div style={{ fontWeight: 800 }}>Run Aktion</div>
      <div style={{ marginTop: 6, color: "#bdbdbd", fontSize: 13 }}>
        Du bist aus einem Run gekommen. Willst du diesen Batch als “Active” setzen?
      </div>

      <button
        onClick={setActive}
        style={{
          marginTop: 10,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #2a2a2a",
          background: "#0f0f0f",
          color: "#fff",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Diesen Batch als Active im Run setzen
      </button>

      {msg ? <div style={{ marginTop: 8, color: "#bdbdbd", fontSize: 13 }}>{msg}</div> : null}
    </div>
  );
}