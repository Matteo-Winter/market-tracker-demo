// app/api/main-categories/import-tree/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMainTree, slugify } from "@/lib/categories/treeText";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = String(body?.text ?? "");
    if (!text.trim()) {
      return NextResponse.json({ ok: false, error: "text fehlt" }, { status: 400 });
    }

    const { mainName, cat2List } = parseMainTree(text);
    const mainSlug = slugify(mainName);

    const result = await prisma.$transaction(async (tx) => {
      // MainCategory upsert
      const main = await tx.mainCategory.upsert({
        where: { slug: mainSlug },
        update: { name: mainName },
        create: { name: mainName, slug: mainSlug },
      });

      let createdCat2 = 0;
      let createdNodes = 0;
      let updatedNodes = 0;

      for (const block of cat2List) {
        const cat2Code = block.cat2.code;
        const cat2Name = block.cat2.name;
        const cat2Slug = `${cat2Code}-${slugify(cat2Name)}`;

        // Category2 upsert-ish (weil slug evtl. nicht unique ist, machen wir findFirst)
        let cat2 = await tx.category2.findFirst({
          where: { mainCategoryId: main.id, slug: cat2Slug },
        });

        if (!cat2) {
          cat2 = await tx.category2.create({
            data: { mainCategoryId: main.id, name: cat2Name, slug: cat2Slug },
          });
          createdCat2 += 1;
        } else {
          // Name ggf. aktualisieren
          if (cat2.name !== cat2Name) {
            cat2 = await tx.category2.update({ where: { id: cat2.id }, data: { name: cat2Name } });
          }
        }

        // existing nodes map (damit parentId gefunden wird)
        const existing = await tx.categoryNode.findMany({
          where: { category2Id: cat2.id },
          select: { id: true, path: true },
        });
        const pathToId = new Map(existing.map((n) => [n.path, n.id]));

        // welche Codes sind Eltern? -> leaf calc
        const parentCodes = new Set<string>();
        for (const n of block.nodes) {
          const parts = n.code.split(".");
          if (parts.length >= 2) parentCodes.add(parts.slice(0, -1).join("."));
        }

        // erst flach, dann tief
        const sorted = [...block.nodes].sort((a, b) => a.depth - b.depth);

        for (const n of sorted) {
          const parts = n.code.split(".");
          const parentCode = parts.slice(0, -1).join(".");
          const parentId = parentCode === cat2Code ? null : pathToId.get(parentCode) ?? null;

          // Wenn parent fehlt, ist die Datei inkonsistent -> hart abbrechen
          if (parentCode !== cat2Code && !parentId) {
            throw new Error(
              `Parent fehlt im DB/Import: "${parentCode}" (für Node "${n.code} ${n.name}"). ` +
                `Füge erst den Parent hinzu oder importiere den vollständigen Tree.`
            );
          }

          const level = n.depth + 1; // Category2 = Level 2, Nodes ab 3
          const isLeaf = !parentCodes.has(n.code);

          const already = pathToId.get(n.code);

          if (!already) {
            const created = await tx.categoryNode.create({
              data: {
                category2Id: cat2.id,
                parentId,
                level,
                name: n.name,
                path: n.code,
                isLeaf,
              },
              select: { id: true },
            });
            pathToId.set(n.code, created.id);
            createdNodes += 1;
          } else {
            await tx.categoryNode.update({
              where: { id: already },
              data: { parentId, level, name: n.name, isLeaf },
            });
            updatedNodes += 1;
          }
        }
      }

      return { main, createdCat2, createdNodes, updatedNodes };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 });
  }
}