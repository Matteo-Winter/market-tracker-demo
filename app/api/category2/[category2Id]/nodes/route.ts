import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ category2Id: string }> }
) {
  const { category2Id } = await params;

  const nodes = await prisma.categoryNode.findMany({
    where: { category2Id },
    select: { id: true, parentId: true, path: true, name: true, isLeaf: true },
    orderBy: { path: "asc" },
  });

  return NextResponse.json({ ok: true, nodes });
}