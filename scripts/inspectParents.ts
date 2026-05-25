import "dotenv/config";
import { prisma } from "../lib/prisma";

function short(id: string) {
  return id.slice(0, 8);
}

function norm(s: string) {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function topCounts(values: (string | null | undefined)[], limit = 3) {
  const m = new Map<string, number>();
  for (const v of values) {
    const x = (v ?? "").toString().trim();
    if (!x) continue;
    m.set(x, (m.get(x) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

async function main() {
  const batchId = process.argv[2];
  if (!batchId) {
    throw new Error("Bitte Batch-ID angeben: npx tsx scripts/inspectParents.ts <BATCH_ID>");
  }

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { category2: { include: { mainCategory: true } } },
  });
  if (!batch) throw new Error("Batch nicht gefunden.");
  if (!batch.month) throw new Error("Batch hat kein month.");

  const month = batch.month;
  const category2Id = batch.category2Id;

  // Alle Child->Parent Zuordnungen für diesen Batch (Monat + Category2)
  const mappings = await prisma.childToParentMap.findMany({
    where: { month, category2Id },
    select: { childAsin: true, parentProductId: true, representativeAsin: true },
  });

  if (mappings.length === 0) {
    console.log("Keine ChildToParentMap-Einträge gefunden. Hast du processBatch wirklich schon laufen lassen?");
    return;
  }

  const parentIds = [...new Set(mappings.map((m) => m.parentProductId))];
  const childAsins = mappings.map((m) => m.childAsin);

  // Parent-Daten
  const parents = await prisma.parentProduct.findMany({
    where: { id: { in: parentIds } },
    select: { id: true, representativeAsin: true, representativeUrl: true, brandNorm: true, titleNorm: true },
  });
  const parentById = new Map(parents.map((p) => [p.id, p]));

  // Child-Rohdaten (aus ProductRow)
  const rows = await prisma.productRow.findMany({
    where: { month, category2Id, asin: { in: childAsins } },
    select: {
      asin: true,
      title: true,
      brand: true,
      brandNorm: true,
      imageUrl: true,
      leafString: true,
      price: true,
      parentRevenue: true,
      parentSales: true,
      asinRevenue: true,
      asinSales: true,
      ean: true,
      gtin: true,
      upc: true,
      isbn: true,
    },
  });
  const rowByAsin = new Map(rows.map((r) => [r.asin, r]));

  // Gruppieren: parentId -> childAsins
  const group = new Map<string, string[]>();
  for (const m of mappings) {
    const arr = group.get(m.parentProductId) ?? [];
    arr.push(m.childAsin);
    group.set(m.parentProductId, arr);
  }

  console.log("=== Parent Review ===");
  console.log("Main → Category2:", batch.category2.mainCategory.name, "→", batch.category2.name);
  console.log("Month:", month);
  console.log("Parents:", group.size);
  console.log("Child rows:", rows.length);
  console.log("");

  // Ausgabe je Parent
  for (const [parentId, asins] of [...group.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const p = parentById.get(parentId);

    const childRows = asins.map((a) => rowByAsin.get(a)).filter(Boolean) as NonNullable<(typeof rows)[number]>[];

    const leafTop = topCounts(childRows.map((r) => r.leafString), 5);
    const brandTop = topCounts(childRows.map((r) => r.brand), 3);

    const distinctImages = new Set(childRows.map((r) => r.imageUrl).filter(Boolean)).size;
    const distinctBrands = new Set(childRows.map((r) => norm(r.brandNorm ?? r.brand ?? ""))).size;
    const distinctLeafs = new Set(childRows.map((r) => norm(r.leafString ?? ""))).size;

    // “Haupt-Parent” check: top ASIN revenue
    const topByRev = [...childRows].sort((x, y) => (y.asinRevenue ?? -1) - (x.asinRevenue ?? -1)).slice(0, 5);
    const repAsin = p?.representativeAsin ?? "(unknown)";

    // Codes: zeigen, ob es doppelte Codes in der Gruppe gibt (gutes Signal)
    const codes = childRows.flatMap((r) => [r.ean, r.gtin, r.upc, r.isbn].filter(Boolean) as string[]);
    const codeCounts = new Map<string, number>();
    for (const c of codes) codeCounts.set(c, (codeCounts.get(c) ?? 0) + 1);
    const duplicatedCodes = [...codeCounts.entries()].filter(([, c]) => c >= 2).slice(0, 5);

    // Red flags (nur Hinweise)
    const flags: string[] = [];
    if (distinctBrands > 1) flags.push("⚠️ mehrere Brands in Gruppe");
    if (distinctLeafs > 1) flags.push("⚠️ mehrere Unterkategorien in Gruppe");
    if (distinctImages > Math.max(3, Math.ceil(asins.length / 3))) flags.push("⚠️ viele unterschiedliche Bilder");

    console.log(`Parent ${short(parentId)} | repASIN: ${repAsin} | children: ${asins.length}`);
    if (flags.length) console.log("  Hinweise:", flags.join(" | "));
    console.log("  Top Unterkategorien:", leafTop.map(([s, c]) => `${c}x ${s}`).join("  |  ") || "-");
    console.log("  Top Brands:", brandTop.map(([s, c]) => `${c}x ${s}`).join("  |  ") || "-");
    console.log("  Distinct images:", distinctImages);
    console.log("  Duplicate codes (signal):", duplicatedCodes.length ? duplicatedCodes.map(([c, n]) => `${n}x ${c}`).join("  |  ") : "-");

    console.log("  Top ASINs by ASIN-Umsatz:");
    for (const r of topByRev) {
      const t = (r.title ?? "").slice(0, 70);
      console.log(`   - ${r.asin} | ASIN-Umsatz: ${r.asinRevenue ?? "-"} | ${t}`);
    }

    // kleine Child-Liste (erste 12)
    console.log("  Beispiel-Children:");
    for (const r of childRows.slice(0, 12)) {
      const t = (r.title ?? "").slice(0, 60);
      console.log(`   - ${r.asin} | Preis: ${r.price ?? "-"} | ${t}`);
    }
    console.log("");
  }
}

main()
  .catch((e) => {
    console.error("❌ Fehler:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
