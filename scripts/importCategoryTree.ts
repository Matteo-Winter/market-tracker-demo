import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

// ---------- helpers ----------
function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, " und ")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type Cat2 = { code: string; name: string };
type NodeEntry = { code: string; name: string; depth: number };

function parseTree(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  const firstNonEmpty = lines.find((l) => l.trim().length > 0);
  if (!firstNonEmpty) throw new Error("Datei ist leer.");

  const mainName = firstNonEmpty.trim();

  const cat2List: { cat2: Cat2; nodes: NodeEntry[] }[] = [];
  let current: { cat2: Cat2; nodes: NodeEntry[] } | null = null;
  let started = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip main category line (first non-empty)
    if (!started && line === mainName) {
      started = true;
      continue;
    }

    // Match: 2. Name  OR 2.1 Name  OR 2.1.1 Name  (dot after code optional)
    const m = line.match(/^(\d+(?:\.\d+)*)(?:\.)?\s+(.*)$/);
    if (!m) continue;

    const code = m[1];
    const name = m[2].trim();
    const depth = code.split(".").length;

    if (depth === 1) {
      // New Category2
      current = { cat2: { code, name }, nodes: [] };
      cat2List.push(current);
    } else {
      if (!current) {
        throw new Error(
          `Node gefunden (${code} ${name}), aber davor keine Kategorie 2. Ordnung (z.B. "2. ...").`
        );
      }
      current.nodes.push({ code, name, depth });
    }
  }

  return { mainName, cat2List };
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    throw new Error('Bitte Pfad angeben, z.B. "data/kueche-haushalt-wohnen.txt"');
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  const text = fs.readFileSync(filePath, "utf8");

  const { mainName, cat2List } = parseTree(text);

  const mainSlug = slugify(mainName);

  // 1) Upsert MainCategory
  const mainCategory = await prisma.mainCategory.upsert({
    where: { slug: mainSlug },
    update: { name: mainName },
    create: { name: mainName, slug: mainSlug },
  });

  // 2) Replace-mode: alte Category2 + Nodes unter dieser MainCategory löschen
  const existingCat2 = await prisma.category2.findMany({
    where: { mainCategoryId: mainCategory.id },
    select: { id: true },
  });
  const cat2Ids = existingCat2.map((x) => x.id);

  if (cat2Ids.length > 0) {
    const batches = await prisma.importBatch.findMany({
      where: { category2Id: { in: cat2Ids } },
      select: { id: true },
    });
    const batchIds = batches.map((b) => b.id);

    if (batchIds.length > 0) {
      await prisma.importFile.deleteMany({ where: { batchId: { in: batchIds } } });
      await prisma.importBatch.deleteMany({ where: { id: { in: batchIds } } });
    }

    await prisma.categoryNode.deleteMany({ where: { category2Id: { in: cat2Ids } } });
    await prisma.category2.deleteMany({ where: { id: { in: cat2Ids } } });
  }

  // 3) Neue Category2 + Nodes anlegen
  let totalNodes = 0;

  for (const block of cat2List) {
    const { code: cat2Code, name: cat2Name } = block.cat2;

    const cat2Slug = `${cat2Code}-${slugify(cat2Name)}`;

    const cat2 = await prisma.category2.create({
      data: {
        mainCategoryId: mainCategory.id,
        name: cat2Name,
        slug: cat2Slug,
      },
    });

    // Leaf-Berechnung: alle Elterncodes sammeln
    const parentCodes = new Set<string>();
    for (const n of block.nodes) {
      const parts = n.code.split(".");
      if (parts.length >= 2) {
        parentCodes.add(parts.slice(0, -1).join("."));
      }
    }

    // Reihenfolge: erst flach, dann tief (damit Eltern vorher da sind)
    const sorted = [...block.nodes].sort((a, b) => a.depth - b.depth);

    const codeToId = new Map<string, string>();

    for (const n of sorted) {
      const parts = n.code.split(".");
      const parentCode = parts.slice(0, -1).join(".");

      const parentId =
        parentCode === cat2Code ? null : codeToId.get(parentCode) ?? null;

      const level = n.depth + 1; // Category2 ist Level 2, Node beginnt ab 3
      const isLeaf = !parentCodes.has(n.code);

      const created = await prisma.categoryNode.create({
        data: {
          category2Id: cat2.id,
          parentId,
          level,
          name: n.name,
          path: n.code, // stabiler Key (z.B. 2.4.9.1)
          isLeaf,
        },
      });

      codeToId.set(n.code, created.id);
      totalNodes += 1;
    }
  }

  console.log("✅ Import fertig");
  console.log("MainCategory:", mainCategory.name, `(${mainCategory.slug})`);
  console.log("Category2:", cat2List.length);
  console.log("Nodes:", totalNodes);
}

main()
  .catch((e) => {
    console.error("❌ Fehler:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
