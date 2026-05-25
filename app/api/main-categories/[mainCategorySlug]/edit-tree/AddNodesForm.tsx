"use client";

import { useState } from "react";

export default function AddNodesForm({ mainCategorySlug }: { mainCategorySlug: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/main-categories/${encodeURIComponent(mainCategorySlug)}/append-nodes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      setMsg(`✅ OK: created ${j.created}, updated ${j.updated}, Category2 touched ${j.touchedCat2}`);
      setText("");
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Fehler"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
      <div style={{ fontWeight: 900 }}>Neue Leafs hinzufügen</div>
      <div style={{ color: "#bdbdbd", fontSize: 13, marginTop: 6 }}>
        Pro Zeile: <span style={{ fontFamily: "monospace" }}>12.7.12.3 Hocker</span> (Tabs/Spaces egal).
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`12.7.12.3 Hocker\n12.7.12.4 Sitzbänke`}
        style={{
          width: "100%",
          height: 160,
          marginTop: 10,
          padding: 10,
          borderRadius: 10,
          border: "1px solid #2a2a2a",
          background: "#0f0f0f",
          color: "#f5f5f5",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
        }}
      />

      <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          disabled={busy || !text.trim()}
          onClick={submit}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #2a2a2a",
            background: busy ? "#222" : "#fff",
            color: busy ? "#bbb" : "#000",
            fontWeight: 800,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          Speichern (nur hinzufügen)
        </button>

        {msg ? <span style={{ color: msg.startsWith("✅") ? "#9fffb2" : "#ffb0b0" }}>{msg}</span> : null}
      </div>

      <div style={{ marginTop: 10, color: "#bdbdbd", fontSize: 13 }}>
        Danach: Für betroffene Category2 im aktuellen Run die <b>Pipeline erneut</b> starten, damit Unmapped → Mapped wird.
      </div>
    </div>
  );
}