import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ snapshotId: string }>;
};

async function deleteSnapshot(request: Request, snapshotId: string) {
  const headerToken = request.headers.get("x-admin-token") ?? "";
  let bodyToken = "";

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    bodyToken = String(form.get("token") ?? "");
  }

  const token = headerToken || bodyToken;

  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$transaction([
    prisma.competitorSnapshotItem.deleteMany({
      where: { snapshotId },
    }),
    prisma.competitorSnapshot.delete({
      where: { id: snapshotId },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Props) {
  try {
    const { snapshotId } = await params;
    if (!snapshotId) {
      return NextResponse.json({ ok: false, error: "snapshotId fehlt" }, { status: 400 });
    }
    return await deleteSnapshot(request, snapshotId);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Snapshot konnte nicht gelöscht werden." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { snapshotId } = await params;
    if (!snapshotId) {
      return NextResponse.json({ ok: false, error: "snapshotId fehlt" }, { status: 400 });
    }
    return await deleteSnapshot(request, snapshotId);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Snapshot konnte nicht gelöscht werden." },
      { status: 500 }
    );
  }
}
