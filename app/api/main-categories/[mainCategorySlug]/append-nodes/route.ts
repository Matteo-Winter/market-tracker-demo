// app/api/main-categories/[mainCategorySlug]/append-nodes/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLooseNodes } from "@/lib/categories/treeText";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ mainCategorySlug: string }> }) {
  try {
    const { mainCategorySlug } = await ctx.params;
    const body = await req.json();
    const text = String(body?.text ?? "");
    if (!text.trim()) return NextResponse.json({ ok: false, error: "text fehlt" }, { status: 400 });

    const main = await prisma.mainCategory.findUnique({ where: { slug: mainCategorySlug } });
    if (!main) return NextResponse.json({ ok: false, error: "MainCategory nicht gefunden" }, { status: 404 });

    const nodes = parseLooseNodes(text);
    if (nodes.length === 0) return NextResponse.json({ ok: false, error: "keine gültigen Zeilen erkannt" }, { status: 400 });

    const byCat2 = new Map<string, typeof nodes>();
    for (const n of nodes) {
      const arr = byCat2.get(n.cat2Code) ?? [];
      arr.push(n);
      byCat2.set(n.cat2Code, arr);
    }

    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let touchedCat2 = 0;

      for (const [cat2Code, list] of byCat2.entries()) {
        const cat2 = await tx.category2.findFirst({
          where: { mainCategoryId: main.id, slug: { startsWith: `${cat2Code}-` } },
        });

        if (!cat2) {
          throw new Error(`Category2 mit Code "${cat2Code}" nicht gefunden. (Existiert diese 2. Ordnung schon im Tree?)`);
        }

        touchedCat2 += 1;

        // vorhandene nodes map
        const existing = await tx.categoryNode.findMany({
          where: { category2Id: cat2.id },
          select: { id: true, path: true },
        });
        const pathToId = new Map(existing.map((x) => [x.path, x.id]));

        // sortiert (flach->tief)
        const sorted = [...list].sort((a, b) => a.depth - b.depth);

        // Track parents (damit leaf status korrekt wird)
        const parentPaths = new Set<string>();

        for (const n of sorted) {
          const parts = n.code.split(".");
          const parentPath = parts.slice(0, -1).join(".");
          if (parentPath) parentPaths.add(parentPath);

          const parentId =
            parentPath === cat2Code ? null : pathToId.get(parentPath) ?? null;

          if (parentPath !== cat2Code && !parentId) {
            throw new Error(`Parent fehlt: "${parentPath}" (für "${n.code} ${n.name}"). Füge erst den Parent hinzu.`);
          }

          const level = n.depth + 1;

          const id = pathToId.get(n.code);
          if (!id) {
            const createdNode = await tx.categoryNode.create({
              data: {
                category2Id: cat2.id,
                parentId,
                level,
                name: n.name,
                path: n.code,
                isLeaf: true,
              },
              select: { id: true },
            });
            pathToId.set(n.code, createdNode.id);
            created += 1;
          } else {
            await tx.categoryNode.update({
              where: { id },
              data: { parentId, level, name: n.name },
            });
            updated += 1;
          }
        }

        // Eltern auf isLeaf=false setzen (weil sie jetzt Kinder haben)
        const parentPathsList = [...parentPaths].filter((p) => p.includes(".")); // echte nodes
        if (parentPathsList.length) {
          const parentIds = parentPathsList.map((p) => pathToId.get(p)).filter(Boolean) as string[];
          if (parentIds.length) {
            await tx.categoryNode.updateMany({ where: { id: { in: parentIds } }, data: { isLeaf: false } });
          }
        }
      }

      return { created, updated, touchedCat2 };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}