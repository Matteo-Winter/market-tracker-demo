import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ category2Id: string }> }) {
  const { category2Id } = await params;

  const body = await req.json().catch(() => null);
  const parentNodeId = typeof body?.parentNodeId === "string" ? body.parentNodeId : null;
  const name = typeof body?.name === "string" ? body.name.trim() : null;

  if (!category2Id || !parentNodeId || !name) {
    return NextResponse.json({ ok: false, error: "category2Id/parentNodeId/name fehlen" }, { status: 400 });
  }

  const parent = await prisma.categoryNode.findUnique({
    where: { id: parentNodeId },
    select: { id: true, category2Id: true, path: true, level: true, isLeaf: true },
  });

  if (!parent || parent.category2Id !== category2Id) {
    return NextResponse.json({ ok: false, error: "Parent Node nicht gefunden oder falsche Category2" }, { status: 404 });
  }

  // Schutz: gleiche Bezeichnung innerhalb Category2 ist für unser Matching gefährlich.
  const existingByName = await prisma.categoryNode.findFirst({
    where: { category2Id, name: { equals: name, mode: "insensitive" } },
    select: { id: true, path: true, name: true },
  });

  if (existingByName) {
    return NextResponse.json({ ok: true, alreadyExisted: true, node: existingByName });
  }

  // Falls parent noch als leaf markiert war: fixen
  if (parent.isLeaf) {
    await prisma.categoryNode.update({ where: { id: parent.id }, data: { isLeaf: false } });
  }

  // Next path index bestimmen: parent.path + "." + (maxSibling+1)
  const siblings = await prisma.categoryNode.findMany({
    where: { category2Id, parentId: parent.id },
    select: { path: true },
  });

  let maxN = 0;
  for (const s of siblings) {
    const last = s.path.split(".").pop() ?? "";
    const n = Number(last);
    if (Number.isInteger(n) && n > maxN) maxN = n;
  }

  const nextN = maxN + 1;
  const newPath = `${parent.path}.${nextN}`;
  const newLevel = parent.level + 1;

  const created = await prisma.categoryNode.create({
    data: {
      category2Id,
      parentId: parent.id,
      level: newLevel,
      name,
      path: newPath,
      isLeaf: true,
    },
    select: { id: true, name: true, path: true },
  });

  return NextResponse.json({ ok: true, node: created });
}