import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Body = {
  // "auto" = löscht Month-Daten nur, wenn kein anderer Batch (month+category2) existiert
  // "keepMonthData" = lässt ChildToParent/Classification/Agg Tabellen in Ruhe
  // "purgeMonthData" = löscht Month-Daten immer (vorsichtig!)
  mode?: "auto" | "keepMonthData" | "purgeMonthData";
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const body: Body = await req.json().catch(() => ({}));

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: { id: true, month: true, category2Id: true },
  });

  if (!batch) {
    return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });
  }

  const mode = body.mode ?? "auto";

  await prisma.$transaction(async (tx) => {
    // Wenn irgendwo activeBatchId auf diesen Batch zeigt -> entfernen
    await tx.runCategory2.updateMany({
      where: { activeBatchId: batchId },
      data: { activeBatchId: null, status: "MISSING" },
    });

    // Batch-gebundene Daten löschen
    await tx.importFile.deleteMany({ where: { batchId } });
    await tx.productRow.deleteMany({ where: { batchId } });

    // Batch selbst löschen
    await tx.importBatch.delete({ where: { id: batchId } });

    // Optional: Month-Daten bereinigen
    if (!batch.month) return;
    if (mode === "keepMonthData") return;

    const remaining = await tx.importBatch.count({
      where: { month: batch.month, category2Id: batch.category2Id },
    });

    const shouldPurge = mode === "purgeMonthData" || remaining === 0;
    if (!shouldPurge) return;

    // Month+Category2 derived data weg
    await tx.childToParentMap.deleteMany({ where: { month: batch.month, category2Id: batch.category2Id } });
    await tx.productClassification.deleteMany({ where: { month: batch.month, category2Id: batch.category2Id } });

    await tx.aggParentProductMonth.deleteMany({ where: { month: batch.month, category2Id: batch.category2Id } });
    await tx.aggBrandNodeMonth.deleteMany({ where: { month: batch.month, category2Id: batch.category2Id } });
    await tx.aggUnmappedParentMonth.deleteMany({ where: { month: batch.month, category2Id: batch.category2Id } });

    // AggCategoryNodeMonth: lösche die Category2/Order3 Einträge + MainCategory Eintrag (damit nichts "stale" bleibt)
    const c2 = await tx.category2.findUnique({
      where: { id: batch.category2Id },
      select: { mainCategoryId: true },
    });

    await tx.aggCategoryNodeMonth.deleteMany({
      where: {
        month: batch.month,
        OR: [
          { scopeLevel: 2, scopeId: batch.category2Id },
          { scopeLevel: 3, category2Id: batch.category2Id },
          ...(c2?.mainCategoryId ? [{ scopeLevel: 1, scopeId: c2.mainCategoryId }] : []),
        ],
      },
    });
  });

  return NextResponse.json({ ok: true });
}