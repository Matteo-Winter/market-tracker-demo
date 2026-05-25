import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reclassifyBatch } from "@/lib/import/reclassifyJob";
import { recomputeRollups } from "@/lib/import/recomputeRollupsJob";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const run = await prisma.importRun.findUnique({
    where: { id: runId },
    include: { category2Links: true },
  });
  if (!run) return NextResponse.json({ ok: false, error: "run not found" }, { status: 404 });

  const actives = run.category2Links
    .map(x => x.activeBatchId)
    .filter((x): x is string => !!x);

  // JobProgress anlegen
  const job = await prisma.jobProgress.create({
    data: {
      jobType: "RUN_REFRESH",
      status: "RUNNING",
      progress: 0,
      message: `Reclassify + Rollups für ${actives.length} Category2`,
    },
    select: { id: true },
  });

  try {
    let done = 0;
    for (const batchId of actives) {
      await reclassifyBatch(batchId);
      await recomputeRollups(batchId);

      done += 1;
      await prisma.jobProgress.update({
        where: { id: job.id },
        data: {
          progress: Math.round((done / actives.length) * 100),
          message: `Fertig: ${done}/${actives.length}`,
        },
      });
    }

    await prisma.jobProgress.update({
      where: { id: job.id },
      data: { status: "DONE", finishedAt: new Date(), progress: 100, message: "DONE" },
    });

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (e: any) {
    await prisma.jobProgress.update({
      where: { id: job.id },
      data: { status: "ERROR", finishedAt: new Date(), message: e?.message ?? "ERROR" },
    });
    return NextResponse.json({ ok: false, jobId: job.id, error: e?.message ?? "ERROR" }, { status: 500 });
  }
}