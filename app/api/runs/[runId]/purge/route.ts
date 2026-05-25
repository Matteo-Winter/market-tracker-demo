export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  if (!runId) return NextResponse.json({ ok: false, error: "runId missing" }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      // andere Runs, die diesen Run als Vergleich nutzen -> entkoppeln
      // WICHTIG: falls dein Feld anders heißt, hier anpassen (siehe Kommentar unten)
      await tx.importRun.updateMany({
        where: { compareToRunId: runId },
        data: { compareToRunId: null },
      });

      // batches entkoppeln
      await tx.importBatch.updateMany({
        where: { runId },
        data: { runId: null },
      });

      // run links löschen
      await tx.runCategory2.deleteMany({ where: { runId } });

      // run löschen
      await tx.importRun.delete({ where: { id: runId } });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}