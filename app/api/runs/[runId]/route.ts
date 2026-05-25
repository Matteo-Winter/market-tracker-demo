import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const body = await req.json().catch(() => ({}));

    if (!runId) {
      return NextResponse.json({ ok: false, error: "runId fehlt" }, { status: 400 });
    }

    let compareToRunId: string | null = null;
    if (typeof body?.compareToRunId === "string" && body.compareToRunId.length > 0) {
      compareToRunId = body.compareToRunId;
    }

    if (compareToRunId === runId) compareToRunId = null; // self-compare verhindern

    await prisma.importRun.update({
      where: { id: runId },
      data: { compareToRunId },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    if (!runId) {
      return NextResponse.json({ ok: false, error: "runId fehlt" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Batches nur detachen (nicht löschen)
      await tx.importBatch.updateMany({
        where: { runId },
        data: { runId: null },
      });

      // Links löschen
      await tx.runCategory2.deleteMany({ where: { runId } });

      // Runs, die diesen Run als Vergleich nutzen, zurücksetzen
      await tx.importRun.updateMany({
        where: { compareToRunId: runId },
        data: { compareToRunId: null },
      });

      // Run löschen
      await tx.importRun.delete({ where: { id: runId } });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 });
  }
}