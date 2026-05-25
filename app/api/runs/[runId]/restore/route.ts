export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MARKER = "__TRASH__:";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  if (!runId) return NextResponse.json({ ok: false, error: "runId missing" }, { status: 400 });

  const run = await prisma.importRun.findUnique({ where: { id: runId } });
  if (!run) return NextResponse.json({ ok: false, error: "Run not found" }, { status: 404 });

  let prevStatus = "CREATED";
  let note = run.note ?? "";

  // Marker-Zeile aus note lesen
  if (note.startsWith(MARKER)) {
    const firstLineEnd = note.indexOf("\n");
    const firstLine = firstLineEnd === -1 ? note : note.slice(0, firstLineEnd);
    const json = firstLine.slice(MARKER.length);

    try {
      const meta = JSON.parse(json);
      if (typeof meta?.prevStatus === "string") prevStatus = meta.prevStatus;
    } catch {}

    // Marker-Zeile entfernen
    note = firstLineEnd === -1 ? "" : note.slice(firstLineEnd + 1);
  }

  await prisma.importRun.update({
    where: { id: runId },
    data: { status: prevStatus, note: note || null },
  });

  return NextResponse.json({ ok: true });
}