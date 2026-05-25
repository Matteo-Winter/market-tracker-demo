"use client";

import { useState } from "react";

export default function ImportMainCategoryForm() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function runImport() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/main-categories/import-tree", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error ?? `HTTP ${r.status}`);
      }
      setMsg(`✅ Import ok: ${j.main.name} · Category2 neu: ${j.createdCat2} · Nodes neu: ${j.createdNodes} · Nodes updated: ${j.updatedNodes}`);
      setText("");
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Fehler"}`);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const t = await f.text();
    setText(t);
  }

  return (
    <div style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
      <div style={{ fontWeight: 900 }}>Neue MainCategory importieren (TXT)</div>
      <div style={{ color: "#bdbdbd", fontSize: 13, marginTop: 6 }}>
        Du kannst hier den kompletten Tree reinkopieren oder eine .txt Datei auswählen.
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input type="file" accept=".txt,text/plain" onChange={onFile} />
        <button
          disabled={busy || !text.trim()}
          onClick={runImport}
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
          Import starten
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Beispiel:\nKüche, Haushalt & Wohnen\n12 Aufbewahrung & Organisation\n12.7.12 Stühle & Strandkörbe\n12.7.12.3 Hocker`}
        style={{
          width: "100%",
          height: 220,
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

      {msg ? <div style={{ marginTop: 10, color: msg.startsWith("✅") ? "#9fffb2" : "#ffb0b0" }}>{msg}</div> : null}
    </div>
  );
}