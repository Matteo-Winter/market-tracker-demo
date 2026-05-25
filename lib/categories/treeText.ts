// lib/categories/treeText.ts
export function slugify(input: string) {
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

export type Cat2Block = {
  cat2: { code: string; name: string };
  nodes: { code: string; name: string; depth: number }[];
};

export function parseMainTree(text: string): { mainName: string; cat2List: Cat2Block[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  const firstNonEmpty = lines.find((l) => l.trim().length > 0);
  if (!firstNonEmpty) throw new Error("Datei ist leer.");

  const mainName = firstNonEmpty.trim();

  const cat2List: Cat2Block[] = [];
  let current: Cat2Block | null = null;
  let started = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip main category line (first non-empty)
    if (!started && line === mainName) {
      started = true;
      continue;
    }

    // Match: 2 Name OR 2.1 Name OR 2.1.1 Name (dot after code optional)
    const m = line.match(/^(\d+(?:\.\d+)*)(?:\.)?\s+(.*)$/);
    if (!m) continue;

    const code = m[1];
    const name = m[2].trim();
    const depth = code.split(".").length;

    if (depth === 1) {
      current = { cat2: { code, name }, nodes: [] };
      cat2List.push(current);
    } else {
      if (!current) {
        throw new Error(`Node gefunden (${code} ${name}), aber davor keine Kategorie 2. Ordnung (z.B. "2 ...").`);
      }
      current.nodes.push({ code, name, depth });
    }
  }

  return { mainName, cat2List };
}

// Für "nur neue Leaf-Zeilen hinzufügen" (mehrere Zeilen möglich)
export function parseLooseNodes(text: string) {
  const out: { code: string; name: string; depth: number; cat2Code: string }[] = [];
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const m = line.match(/^(\d+(?:\.\d+)*)(?:\.)?\s+(.*)$/);
    if (!m) continue;

    const code = m[1];
    const name = m[2].trim();
    const depth = code.split(".").length;
    const cat2Code = code.split(".")[0];

    out.push({ code, name, depth, cat2Code });
  }

  return out;
}