import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId missing" }, { status: 400 });
  }

  const job = await prisma.jobProgress.findUnique({ where: { id: jobId } });

  if (!job) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, job });
}