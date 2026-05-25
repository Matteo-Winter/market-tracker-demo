import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const v = body?.collectedDate;

  // leer => null
  const collectedDate =
    typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

  // wenn gesetzt: muss YYYY-MM-DD sein
  if (collectedDate && !/^\d{4}-\d{2}-\d{2}$/.test(collectedDate)) {
    return NextResponse.json(
      { ok: false, error: "Format muss YYYY-MM-DD sein" },
      { status: 400 }
    );
  }

  await prisma.importRun.update({
    where: { id: runId },
    data: { collectedDate },
  });

  return NextResponse.json({ ok: true, collectedDate });
}
