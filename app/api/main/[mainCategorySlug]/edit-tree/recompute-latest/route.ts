import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reclassifyBatch } from "@/lib/import/reclassifyJob";
import { recomputeRollups } from "@/lib/import/recomputeRollupsJob";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ mainCategorySlug: string }> }
) {
  const { mainCategorySlug } = await params;

  const main = await prisma.mainCategory.findUnique({ where: { slug: mainCategorySlug }, select: { id: true } });
  if (!main) return NextResponse.json({ ok: false, error: "MainCategory nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const runId = body?.runId as string | undefined;

  const run = runId
    ? await prisma.importRun.findFirst({
        where: { id: runId, mainCategoryId: main.id },
        include: { category2Links: true },
      })
    : await prisma.importRun.findFirst({
        where: { mainCategoryId: main.id },
        orderBy: { month: "desc" },
        include: { category2Links: true },
      });

  if (!run) return NextResponse.json({ ok: false, error: "Kein Run vorhanden (erst Run anlegen)." }, { status: 400 });

  const batchIds = run.category2Links.map((x) => x.activeBatchId).filter((x): x is string => typeof x === "string" && x.length > 0);

  if (batchIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Run hat keine activeBatchId gesetzt." }, { status: 400 });
  }

  const job = await prisma.jobProgress.create({
    data: {
      jobType: "RUN_RECOMPUTE",
      status: "RUNNING",
      progress: 0,
      message: `run=${run.id} month=${run.month}`,
    },
  });

  try {
    const total = batchIds.length;

    for (let i = 0; i < total; i++) {
      const batchId = batchIds[i];

      await prisma.jobProgress.update({
        where: { id: job.id },
        data: { progress: Math.round((i / total) * 100), message: `(${i + 1}/${total}) batch=${batchId}: processBatch...` },
      });

      await prisma.importBatch.update({ where: { id: batchId }, data: { status: "PROCESSING" } }).catch(() => {});
      await reclassifyBatch(batchId);

      await prisma.jobProgress.update({
        where: { id: job.id },
        data: { progress: Math.round(((i + 0.7) / total) * 100), message: `(${i + 1}/${total}) batch=${batchId}: recomputeRollups...` },
      });

      await recomputeRollups(batchId);
      await prisma.importBatch.update({ where: { id: batchId }, data: { status: "DONE" } }).catch(() => {});
    }

    await prisma.jobProgress.update({
      where: { id: job.id },
      data: { status: "FINISHED", progress: 100, finishedAt: new Date(), message: "done" },
    });

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (e: any) {
    await prisma.jobProgress
      .update({
        where: { id: job.id },
        data: { status: "ERROR", finishedAt: new Date(), message: e?.message ?? "unknown error" },
      })
      .catch(() => {});

    return NextResponse.json({ ok: false, jobId: job.id, error: e?.message ?? "unknown error" }, { status: 500 });
  }
}