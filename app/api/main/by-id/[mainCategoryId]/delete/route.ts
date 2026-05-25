import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ mainCategoryId: string }> }
) {
  const { mainCategoryId } = await params;
  if (!mainCategoryId) {
    return NextResponse.json({ ok: false, error: "mainCategoryId missing" }, { status: 400 });
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // MainCategory soft-delete
    await tx.mainCategory.update({
      where: { id: mainCategoryId },
      data: { deletedAt: now },
    });

    // Alle Runs dieser MainCategory soft-delete
    await tx.importRun.updateMany({
      where: { mainCategoryId, deletedAt: null },
      data: { deletedAt: now, status: "TRASHED" },
    });
  });

  return NextResponse.json({ ok: true });
}