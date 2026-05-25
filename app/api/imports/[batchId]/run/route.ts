import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processBatch } from "@/lib/import/processBatchJob";
import { recomputeRollups } from "@/lib/import/recomputeRollupsJob";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  const job = await prisma.jobProgress.create({
    data: {
      jobType: "IMPORT_PIPELINE",
      status: "RUNNING",
      progress: 0,
      message: `batch=${batchId}`,
    },
  });

  try {
    await prisma.importBatch.update({
      where: { id: batchId },
      data: { status: "PROCESSING" },
    });

    await prisma.jobProgress.update({
      where: { id: job.id },
      data: { progress: 10, message: "processBatch..." },
    });

    await processBatch(batchId);

    await prisma.jobProgress.update({
      where: { id: job.id },
      data: { progress: 70, message: "recomputeRollups..." },
    });

    await recomputeRollups(batchId);

    await prisma.importBatch.update({
      where: { id: batchId },
      data: { status: "DONE" },
    });

    await prisma.jobProgress.update({
      where: { id: job.id },
      data: { status: "FINISHED", progress: 100, finishedAt: new Date(), message: "done" },
    });

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (e: any) {
    await prisma.importBatch
      .update({ where: { id: batchId }, data: { status: "ERROR" } })
      .catch(() => {});

    await prisma.jobProgress
      .update({
        where: { id: job.id },
        data: { status: "ERROR", finishedAt: new Date(), message: e?.message ?? "unknown error" },
      })
      .catch(() => {});

    return NextResponse.json({ ok: false, jobId: job.id, error: e?.message ?? "unknown error" }, { status: 500 });
  }
}