import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!runId) return NextResponse.json({ ok: false, error: "runId missing" }, { status: 400 });

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Andere Runs, die auf diesen Run zeigen, entkoppeln
    await tx.importRun.updateMany({
      where: { compareToRunId: runId },
      data: { compareToRunId: null },
    });

    // Soft delete
    await tx.importRun.update({
      where: { id: runId },
      data: { deletedAt: now, status: "TRASHED" },
    });
  });

  return NextResponse.json({ ok: true });
}