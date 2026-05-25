import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ mainCategoryId: string }> }
) {
  const { mainCategoryId } = await params;

  if (!mainCategoryId) {
    return NextResponse.json({ ok: false, error: "mainCategoryId missing" }, { status: 400 });
  }

  const main = await prisma.mainCategory.findUnique({
    where: { id: mainCategoryId },
    select: { id: true },
  });

  if (!main) {
    return NextResponse.json({ ok: false, error: "MainCategory not found" }, { status: 404 });
  }

  const c2s = await prisma.category2.findMany({
    where: { mainCategoryId },
    select: { id: true },
  });
  const category2Ids = c2s.map((x) => x.id);

  const runs = await prisma.importRun.findMany({
    where: { mainCategoryId },
    select: { id: true },
  });
  const runIds = runs.map((x) => x.id);

  const batches = category2Ids.length
    ? await prisma.importBatch.findMany({
        where: { category2Id: { in: category2Ids } },
        select: { id: true },
      })
    : [];
  const batchIds = batches.map((x) => x.id);

  await prisma.$transaction(async (tx) => {
    if (category2Ids.length) {
      await tx.aggCategoryNodeMonth.deleteMany({ where: { mainCategoryId } });

      await tx.aggBrandNodeMonth.deleteMany({ where: { category2Id: { in: category2Ids } } });
      await tx.aggUnmappedParentMonth.deleteMany({ where: { category2Id: { in: category2Ids } } });
      await tx.aggParentProductMonth.deleteMany({ where: { category2Id: { in: category2Ids } } });

      await tx.productClassification.deleteMany({ where: { category2Id: { in: category2Ids } } });
      await tx.childToParentMap.deleteMany({ where: { category2Id: { in: category2Ids } } });
      await tx.productRow.deleteMany({ where: { category2Id: { in: category2Ids } } });

      await tx.parentProduct.deleteMany({ where: { category2Id: { in: category2Ids } } });
      await tx.categoryNode.deleteMany({ where: { category2Id: { in: category2Ids } } });
    }

    if (batchIds.length) {
      await tx.importFile.deleteMany({ where: { batchId: { in: batchIds } } });
      await tx.importBatch.deleteMany({ where: { id: { in: batchIds } } });
    }

    if (runIds.length) {
      await tx.runCategory2.deleteMany({ where: { runId: { in: runIds } } });
      await tx.importRun.deleteMany({ where: { id: { in: runIds } } });
    }

    await tx.category2.deleteMany({ where: { mainCategoryId } });
    await tx.mainCategory.delete({ where: { id: mainCategoryId } });
  });

  return NextResponse.json({ ok: true });
}
