import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!runId) return NextResponse.json({ ok: false, error: "runId missing" }, { status: 400 });

  const run = await prisma.importRun.findUnique({
    where: { id: runId },
    select: { id: true, deletedAt: true },
  });

  if (!run) return NextResponse.json({ ok: false, error: "Run not found" }, { status: 404 });

  await prisma.importRun.update({
    where: { id: runId },
    data: { deletedAt: null, status: "CREATED" },
  });

  return NextResponse.json({ ok: true });
}