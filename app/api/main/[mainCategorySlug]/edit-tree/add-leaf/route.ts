import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ mainCategorySlug: string }> }
) {
  const { mainCategorySlug } = await params;

  const body = await req.json().catch(() => ({}));

  const category2Id = String(body?.category2Id ?? "");
  const parentPath = String(body?.parentPath ?? "");
  const name = String(body?.name ?? "").trim();

  // optional (falls du später doch “manuell” willst – UI sendet es NICHT mehr)
  const newIndexRaw = body?.newIndex == null ? "" : String(body.newIndex).trim();

  if (!category2Id || !parentPath || !name) {
    return NextResponse.json(
      { ok: false, error: "category2Id, parentPath, name sind Pflichtfelder." },
      { status: 400 }
    );
  }

  if (!/^\d+(\.\d+)*$/.test(parentPath)) {
    return NextResponse.json(
      { ok: false, error: "parentPath muss wie 12.7.12 aussehen (nur Zahlen + Punkte)." },
      { status: 400 }
    );
  }

  if (newIndexRaw && !/^\d+$/.test(newIndexRaw)) {
    return NextResponse.json(
      { ok: false, error: "newIndex muss eine Zahl sein (z.B. 3)." },
      { status: 400 }
    );
  }

  const main = await prisma.mainCategory.findUnique({
    where: { slug: mainCategorySlug },
    select: { id: true },
  });
  if (!main) {
    return NextResponse.json({ ok: false, error: "MainCategory nicht gefunden." }, { status: 404 });
  }

  const c2 = await prisma.category2.findFirst({
    where: { id: category2Id, mainCategoryId: main.id },
    select: { id: true },
  });
  if (!c2) {
    return NextResponse.json(
      { ok: false, error: "Category2 gehört nicht zu dieser MainCategory." },
      { status: 400 }
    );
  }

  const parent = await prisma.categoryNode.findFirst({
    where: { category2Id, path: parentPath },
    select: { id: true, level: true, isLeaf: true },
  });
  if (!parent) {
    return NextResponse.json(
      { ok: false, error: `Parent Node nicht gefunden: ${parentPath}` },
      { status: 400 }
    );
  }

  // ✅ Index automatisch bestimmen: max(childIndex)+1
  let newIndex = 0;

  if (newIndexRaw) {
    newIndex = Number(newIndexRaw);
  } else {
    const children = await prisma.categoryNode.findMany({
      where: { category2Id, parentId: parent.id },
      select: { path: true },
    });

    let maxN = 0;
    for (const c of children) {
      const last = c.path.split(".").pop() ?? "";
      const n = Number(last);
      if (Number.isFinite(n) && n > maxN) maxN = n;
    }
    newIndex = maxN + 1;
  }

  const fullPath = `${parentPath}.${newIndex}`;

  const exists = await prisma.categoryNode.findFirst({
    where: { category2Id, path: fullPath },
    select: { id: true },
  });
  if (exists) {
    return NextResponse.json(
      { ok: false, error: `Node existiert schon: ${fullPath}` },
      { status: 400 }
    );
  }

  const node = await prisma.categoryNode.create({
    data: {
      category2Id,
      parentId: parent.id,
      level: parent.level + 1,
      name,
      path: fullPath,
      isLeaf: true,
    },
  });

  // Parent darf nicht mehr Leaf sein, wenn er jetzt Kind hat
  if (parent.isLeaf) {
    await prisma.categoryNode.update({ where: { id: parent.id }, data: { isLeaf: false } });
  }

  return NextResponse.json({ ok: true, node });
}