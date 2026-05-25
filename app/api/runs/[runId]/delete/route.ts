import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  if (!runId) return NextResponse.json({ ok: false, error: "runId missing" }, { status: 400 });

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1) alle Runs, die auf diesen Run vergleichen, entkoppeln (sonst FK/Logik-Probleme)
    await tx.importRun.updateMany({
      where: { compareToRunId: runId },
      data: { compareToRunId: null },
    });

    // 2) Run soft-delete
    await tx.importRun.update({
      where: { id: runId },
      data: { deletedAt: now, status: "TRASHED" },
    });
  });

  return NextResponse.json({ ok: true });
}