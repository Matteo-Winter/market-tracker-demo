import { prisma } from "../../../../lib/prisma";
import { parse } from "csv-parse/sync";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ batchId: string }>;
};

function normalize(s: string) {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " und ")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .replace(/["']/g, "");
}

export default async function UnmappedPage({ params }: Props) {
  const { batchId } = await params;

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      category2: { include: { mainCategory: true } },
      files: true,
    },
  });

  if (!batch) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        Batch nicht gefunden.
      </main>
    );
  }

  const file = batch.files[0];
  const csvText = file?.contentText ?? "";
  if (!csvText) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        Keine CSV-Daten in dieser Batch gefunden.
      </main>
    );
  }

  // Leaf-Nodes aus dem Tree holen (für dieses Category2)
  const leafNodes = await prisma.categoryNode.findMany({
    where: { category2Id: batch.category2Id, isLeaf: true },
    select: { id: true, name: true, path: true },
  });

  const leafSet = new Set(leafNodes.map((n) => normalize(n.name)));

  // CSV parsen (dein Format ist "..." mit Kommas)
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  });

  // Unterkategorie zählen
  const counts = new Map<string, number>();
  const mappedCounts = new Map<string, number>();

  for (const r of records) {
    // Header kann exakt "Unterkategorie" heißen (wie bei dir)
    const raw = (r["Unterkategorie"] ?? "").toString().trim();
    if (!raw) continue;

    const key = normalize(raw);
    counts.set(raw, (counts.get(raw) ?? 0) + 1);

    if (leafSet.has(key)) {
      mappedCounts.set(raw, (mappedCounts.get(raw) ?? 0) + 1);
    }
  }

  // Unmapped = alles, was nicht im leafSet existiert
  const unmapped = Array.from(counts.entries())
    .filter(([name]) => !leafSet.has(normalize(name)))
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const totalDistinct = counts.size;
  const mappedDistinct = Array.from(counts.keys()).filter((k) =>
    leafSet.has(normalize(k))
  ).length;
  const unmappedDistinct = unmapped.length;

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui",
        background: "#0b0b0b",
        color: "#f5f5f5",
        minHeight: "100vh",
      }}
    >
      <a
        href={`/imports/${batchId}`}
        style={{ color: "#bdbdbd", textDecoration: "underline" }}
      >
        ← zurück zur Import-Preview
      </a>

      <h1 style={{ marginTop: 12, fontSize: 22, fontWeight: 800 }}>
        Unmapped Queue
      </h1>
      <p style={{ color: "#bdbdbd", marginTop: 6 }}>
        {batch.category2.mainCategory.name} → {batch.category2.name} | Month:{" "}
        {batch.month ?? "-"}
      </p>

      <div
        style={{
          marginTop: 14,
          border: "1px solid #2a2a2a",
          borderRadius: 12,
          padding: 12,
          background: "#121212",
        }}
      >
        <div style={{ fontWeight: 800 }}>Zusammenfassung</div>
        <div style={{ marginTop: 6, color: "#bdbdbd" }}>
          Distinct Unterkategorien gesamt: <b style={{ color: "#fff" }}>{totalDistinct}</b>
          {"  "} | gemappt: <b style={{ color: "#fff" }}>{mappedDistinct}</b>
          {"  "} | unmapped: <b style={{ color: "#fff" }}>{unmappedDistinct}</b>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          border: "1px solid #2a2a2a",
          borderRadius: 12,
          padding: 12,
          background: "#171717",
        }}
      >
        <div style={{ fontWeight: 800 }}>Unmapped Liste (nach Häufigkeit)</div>

        {unmapped.length === 0 ? (
          <div style={{ marginTop: 10, color: "#9a9a9a" }}>
            ✅ Alles gemappt – keine Unmapped-Unterkategorien gefunden.
          </div>
        ) : (
          <ul style={{ marginTop: 10, paddingLeft: 18 }}>
            {unmapped.slice(0, 200).map((u) => (
              <li key={u.name} style={{ marginTop: 6 }}>
                <b>{u.count}x</b> — {u.name}
              </li>
            ))}
          </ul>
        )}

        {unmapped.length > 200 ? (
          <div style={{ marginTop: 10, color: "#9a9a9a" }}>
            (Zeige nur die ersten 200 Einträge)
          </div>
        ) : null}
      </div>
    </main>
  );
}
