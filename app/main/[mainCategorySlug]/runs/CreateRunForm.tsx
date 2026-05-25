"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateRunForm({
  mainCategorySlug,
  options,
}: {
  mainCategorySlug: string;
  options?: { id: string; month: string }[];
}) {
  const router = useRouter();
  const opts = Array.isArray(options) ? options : [];

  const [month, setMonth] = useState("");
  const [compareToRunId, setCompareToRunId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const suggestedCompare = useMemo(() => {
    // Heuristik: nimm den “nächstälteren” Run als Vorschlag (optional)
    // (wir setzen NICHT automatisch, nur Vorschlag)
    return opts[0]?.id ?? "";
  }, [opts]);

  async function create() {
    try {
      setStatus("");

      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        setStatus("❌ Format muss YYYY-MM sein (z.B. 2026-03).");
        return;
      }

      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mainCategorySlug,
          month,
          compareToRunId: compareToRunId || null,
        }),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        setStatus(`❌ API hat kein JSON zurückgegeben (HTTP ${res.status})`);
        return;
      }

      if (!res.ok || !data?.ok) {
        setStatus(`❌ ${data?.error ?? `HTTP ${res.status}`}`);
        return;
      }

      setStatus("✅ Run erstellt");
      router.push(`/main/${mainCategorySlug}/runs/${data.runId}`);
      router.refresh();
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? "unknown error"}`);
    }
  }

  return (
    <div style={{ border: "1px solid #2a2a2a", borderRadius: 14, padding: 14, background: "#121212" }}>
      <div style={{ fontWeight: 900, fontSize: 16 }}>Neuen Run anlegen</div>

      <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "#bdbdbd", fontSize: 12 }}>Month (YYYY-MM)</span>
          <input
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="2026-03" // Hier den Tag ergänzen
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #2a2a2a",
              background: "#0f0f0f",
              color: "#fff",
              width: 180,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "#bdbdbd", fontSize: 12 }}>Vergleich (optional)</span>
          <select
            value={compareToRunId}
            onChange={(e) => setCompareToRunId(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #2a2a2a",
              background: "#0f0f0f",
              color: "#fff",
              minWidth: 240,
            }}
          >
            <option value="">— kein Vergleich —</option>
            {opts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.month} · {o.id.slice(0, 8)}…
              </option>
            ))}
          </select>
          <div style={{ color: "#666", fontSize: 11 }}>
            Tipp: Vormonat auswählen (z.B. {suggestedCompare ? "oben in der Liste" : "—"})
          </div>
        </label>

        <button
          onClick={create}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #2a2a2a",
            background: "#0f0f0f",
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
            marginTop: 18,
          }}
        >
          Run erstellen
        </button>
      </div>

      {status ? <div style={{ marginTop: 10, color: status.startsWith("✅") ? "#7CFC9A" : "#ff6b6b" }}>{status}</div> : null}
    </div>
  );
}