import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string; category2Id: string }> }
) {
  const { runId, category2Id } = await params;
  const body = await req.json().catch(() => ({}));
  const batchId = body.batchId ? String(body.batchId) : null;

  // activeBatchId setzen (oder null = deaktivieren)
  await prisma.runCategory2.update({
    where: { runId_category2Id: { runId, category2Id } },
    data: {
      activeBatchId: batchId,
      status: batchId ? "READY" : "MISSING",
    },
  });

  // wenn batch gewählt: dem run zuordnen
  if (batchId) {
    await prisma.importBatch.update({
      where: { id: batchId },
      data: { runId },
    });
  }

  return NextResponse.json({ ok: true });
}