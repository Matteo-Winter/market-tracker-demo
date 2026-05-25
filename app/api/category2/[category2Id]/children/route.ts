import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ category2Id: string }> }
) {
  const { category2Id } = await params;

  const url = new URL(req.url);
  const parentIdRaw = url.searchParams.get("parentId");
  const parentId = parentIdRaw && parentIdRaw !== "null" ? parentIdRaw : null;

  const nodes = await prisma.categoryNode.findMany({
    where: { category2Id, parentId },
    orderBy: { path: "asc" },
    select: { id: true, path: true, name: true, isLeaf: true },
  });

  return NextResponse.json({ ok: true, nodes });
}