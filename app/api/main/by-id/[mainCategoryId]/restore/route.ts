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

  const main = await prisma.mainCategory.findUnique({
    where: { id: mainCategoryId },
    select: { deletedAt: true },
  });

  if (!main) return NextResponse.json({ ok: false, error: "MainCategory not found" }, { status: 404 });
  if (!main.deletedAt) {
    return NextResponse.json({ ok: false, error: "MainCategory is not deleted" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.mainCategory.update({
      where: { id: mainCategoryId },
      data: { deletedAt: null },
    });

    // Runs wiederherstellen (nur die, die TRASHED sind)
    await tx.importRun.updateMany({
      where: { mainCategoryId, status: "TRASHED" },
      data: { deletedAt: null, status: "CREATED" },
    });
  });

  return NextResponse.json({ ok: true });
}
