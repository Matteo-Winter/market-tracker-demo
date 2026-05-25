import { prisma } from "../prisma";

function norm(s: string) {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " und ")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ");
}

export async function reclassifyBatch(batchId: string) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { category2: true },
  });
  if (!batch) throw new Error("Batch nicht gefunden.");
  if (!batch.month) throw new Error("Batch.month fehlt.");

  const month = batch.month;
  const category2Id = batch.category2Id;

  // Kategoriebaum laden
  const allNodes = await prisma.categoryNode.findMany({
    where: { category2Id },
    select: { id: true, name: true, path: true, isLeaf: true },
  });

  const leafByName = new Map(allNodes.filter(n => n.isLeaf).map(n => [norm(n.name), n]));
  const anyByName  = new Map(allNodes.map(n => [norm(n.name), n]));
  const nodeByPath = new Map(allNodes.map(n => [n.path, n])); // für Order3 lookup

  // alte Klassifikation löschen (nur Klassifikation!)
  await prisma.productClassification.deleteMany({ where: { month, category2Id } });

  // Parent-Gruppen aus bestehendem Mapping
  const maps = await prisma.childToParentMap.findMany({
    where: { month, category2Id },
    select: { parentProductId: true, childAsin: true },
  });
  if (maps.length === 0) throw new Error("Keine ChildToParentMap Einträge – erst processBatch laufen lassen.");

  const childrenByParent = new Map<string, string[]>();
  for (const m of maps) {
    const arr = childrenByParent.get(m.parentProductId) ?? [];
    arr.push(m.childAsin);
    childrenByParent.set(m.parentProductId, arr);
  }

  // Produktzeilen holen (LeafString + Umsatz für Mehrheit)
  const rows = await prisma.productRow.findMany({
    where: { month, category2Id },
    select: { asin: true, leafString: true, asinRevenue: true },
  });
  const rowByAsin = new Map(rows.map(r => [r.asin, r]));

  const createData: any[] = [];

  for (const [parentProductId, childAsins] of childrenByParent.entries()) {
    const leafRev = new Map<string, number>();
    const leafCnt = new Map<string, number>();

    for (const asin of childAsins) {
      const r = rowByAsin.get(asin);
      const ls = r?.leafString ?? null;
      if (!ls) continue;

      leafCnt.set(ls, (leafCnt.get(ls) ?? 0) + 1);
      const rev = typeof r?.asinRevenue === "number" ? r!.asinRevenue! : 0;
      leafRev.set(ls, (leafRev.get(ls) ?? 0) + rev);
    }

    let leafString: string | null = null;
    if (leafRev.size) leafString = [...leafRev.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] ?? null;
    else if (leafCnt.size) leafString = [...leafCnt.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] ?? null;

    let leafNodeId: string | null = null;
    let order3NodeId: string | null = null;
    let isUnmapped = true;

    if (leafString) {
      const key = norm(leafString);
      const matched = leafByName.get(key) ?? anyByName.get(key);

      if (matched) {
        isUnmapped = false;
        leafNodeId = matched.isLeaf ? matched.id : null;

        // Order3 = erste 2 Teile des path
        const parts = matched.path.split(".");
        const order3Path = parts.length >= 2 ? parts.slice(0,2).join(".") : matched.path;

        const order3 = nodeByPath.get(order3Path);
        order3NodeId = order3?.id ?? matched.id;
      }
    }

    createData.push({
      month,
      category2Id,
      parentProductId,
      leafString,
      leafNodeId,
      order3NodeId,
      isUnmapped,
    });
  }

  if (createData.length) {
    await prisma.productClassification.createMany({ data: createData });
  }

  return { month, category2Id, parents: createData.length };
}