import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!runId) return NextResponse.json({ ok: false, error: "runId missing" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    // Batches vom Run lösen (sonst FK-Probleme)
    await tx.importBatch.updateMany({
      where: { runId },
      data: { runId: null },
    });

    // Links RunCategory2 löschen
    await tx.runCategory2.deleteMany({ where: { runId } });

    // Run final löschen
    await tx.importRun.delete({ where: { id: runId } });

    // Andere Runs entkoppeln, die auf diesen Run zeigen
    await tx.importRun.updateMany({
      where: { compareToRunId: runId },
      data: { compareToRunId: null },
    });
  });

  return NextResponse.json({ ok: true });
}