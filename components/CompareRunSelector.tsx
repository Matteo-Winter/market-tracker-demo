"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function CompareRunSelector(props: {
  options: { id: string; month: string }[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function onChange(id: string) {
    const q = new URLSearchParams(sp.toString());
    if (!id) q.delete("compareRunId");
    else q.set("compareRunId", id);
    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <div style={{ marginTop: 12, border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
      <div style={{ fontWeight: 800 }}>Vergleich (Run-Ebene)</div>
      <div style={{ marginTop: 6, color: "#bdbdbd", fontSize: 13 }}>
        Wähle den Vergleichs-Run (z.B. Vormonat) für diesen Monatslauf.
      </div>

      <select
        value={props.selectedId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          marginTop: 10,
          padding: 10,
          borderRadius: 10,
          border: "1px solid #2a2a2a",
          background: "#0f0f0f",
          color: "#fff",
        }}
      >
        <option value="">(kein Vergleich)</option>
        {props.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.month} · {o.id.slice(0, 8)}…
          </option>
        ))}
      </select>
    </div>
  );
}