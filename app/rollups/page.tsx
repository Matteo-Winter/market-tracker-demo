export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function RollupsIndexPage() {
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { category2: { include: { mainCategory: true } } },
  });

  // Dedupe auf (month + category2Id), weil es mehrere Batches geben kann
  const seen = new Set<string>();
  const items = batches
    .filter((b) => !!b.month)
    .filter((b) => {
      const key = `${b.month}|${b.category2Id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Rollups</h1>
      <p className="text-sm opacity-80">
        Klicke auf einen Monat + Category2, um Parent-Gruppen & Child-ASINs zu prüfen.
      </p>

      <div className="space-y-3">
        {items.map((b) => (
          <div key={b.id} className="rounded-xl border p-4">
            <div className="text-sm opacity-80">
              {b.category2.mainCategory.name} → {b.category2.name}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">{b.month}</div>
              <Link
                className="underline"
                href={`/rollups/${b.month}/${b.category2Id}`}
              >
                Rollup öffnen
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
