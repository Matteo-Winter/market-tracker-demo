import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const body = await req.json().catch(() => ({} as any));
  const compareToRunIdRaw = body?.compareToRunId;

  const compareToRunId =
    typeof compareToRunIdRaw === "string" && compareToRunIdRaw.length > 0
      ? compareToRunIdRaw
      : null;

  if (!runId) {
    return NextResponse.json({ ok: false, error: "runId missing" }, { status: 400 });
  }
  if (compareToRunId === runId) {
    return NextResponse.json({ ok: false, error: "cannot compare run to itself" }, { status: 400 });
  }

  // optional: sicherstellen, dass beide Runs zur selben mainCategory gehören
  if (compareToRunId) {
    const [run, cmp] = await Promise.all([
      prisma.importRun.findUnique({ where: { id: runId }, select: { mainCategoryId: true } }),
      prisma.importRun.findUnique({ where: { id: compareToRunId }, select: { mainCategoryId: true } }),
    ]);
    if (!run || !cmp || run.mainCategoryId !== cmp.mainCategoryId) {
      return NextResponse.json({ ok: false, error: "compare run not compatible" }, { status: 400 });
    }
  }

  await prisma.importRun.update({
    where: { id: runId },
    data: { compareToRunId },
  });

  return NextResponse.json({ ok: true, compareToRunId });
}