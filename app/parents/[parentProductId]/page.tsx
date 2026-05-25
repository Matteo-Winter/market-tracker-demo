export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

function eur(n: number | null | undefined) {
  if (typeof n !== "number") return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}
function num(n: number | null | undefined) {
  if (typeof n !== "number") return "–";
  return new Intl.NumberFormat("de-DE").format(n);
}
function pct(n: number | null | undefined) {
  if (typeof n !== "number") return "–";
  const sign = n > 0 ? "+" : "";
  return `${sign}${Math.round(n * 100)}%`;
}

function mom(cur: number | null | undefined, prev: number | null | undefined) {
  if (typeof cur !== "number" || typeof prev !== "number") return null;
  if (prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
}

function amazonUrl(asin: string) {
  return `https://www.amazon.de/dp/${asin}`;
}

export default async function ParentHistoryPage({
  params,
}: {
  params: Promise<{ parentProductId: string }>;
}) {
  const { parentProductId } = await params;

  const parent = await prisma.parentProduct.findUnique({
    where: { id: parentProductId },
    include: { category2: { include: { mainCategory: true } } },
  });
  if (!parent) notFound();

  const months = await prisma.aggParentProductMonth.findMany({
    where: { parentProductId, category2Id: parent.category2Id },
    orderBy: { month: "asc" },
  });

  const latest = months.length ? months[months.length - 1] : null;

  // Child-ASINs über ALLE Monate (distinct)
  const allMappings = await prisma.childToParentMap.findMany({
    where: { parentProductId, category2Id: parent.category2Id },
    select: { childAsin: true, month: true },
  });
  const childSet = new Set(allMappings.map((m) => m.childAsin));
  const childAsins = [...childSet].sort();

  // Order3 Node-Namen für Timeline (optional)
  const order3Ids = [...new Set(months.map((m) => m.order3NodeId).filter(Boolean))] as string[];
  const nodes = order3Ids.length
    ? await prisma.categoryNode.findMany({
        where: { id: { in: order3Ids } },
        select: { id: true, name: true, path: true },
      })
    : [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <div className="text-sm opacity-80">
          {parent.category2.mainCategory.name} → {parent.category2.name}
        </div>

        <h1 className="text-2xl font-semibold">Parent History</h1>

        <div className="text-sm opacity-80">
          ParentProductId: <span className="font-mono">{parent.id}</span>
        </div>

        <div className="text-sm">
          Representative:{" "}
          <a
            className="underline"
            href={parent.representativeUrl ?? amazonUrl(parent.representativeAsin)}
            target="_blank"
          >
            {parent.representativeAsin}
          </a>{" "}
          · Brand: <b>{parent.brandNorm ?? "–"}</b>
        </div>

        <div className="text-sm opacity-80">
          Distinct Child-ASINs (über alle Monate): <b>{childAsins.length}</b>
        </div>

        <div className="text-sm flex gap-3">
          <Link className="underline" href="/rollups">← Rollups</Link>
          {latest ? (
            <Link className="underline" href={`/rollups/${latest.month}/${parent.category2Id}`}>
              → Rollup {latest.month}
            </Link>
          ) : null}
        </div>
      </div>

      {months.length === 0 ? (
        <div className="rounded-xl border p-4">
          Keine Monats-Rollups für diesen Parent gefunden. (Du musst erst für mindestens einen Batch `recomputeRollups.ts` laufen lassen.)
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="py-2 px-3">Monat</th>
                <th className="py-2 px-3">Order3</th>
                <th className="py-2 px-3">Leaf</th>

                <th className="py-2 px-3">Parent-Umsatz</th>
                <th className="py-2 px-3">MoM Umsatz</th>

                <th className="py-2 px-3">Parent-Sales</th>
                <th className="py-2 px-3">MoM Sales</th>

                <th className="py-2 px-3">Child Count</th>
                <th className="py-2 px-3">Δ Child</th>

                <th className="py-2 px-3">Preis (Median)</th>
                <th className="py-2 px-3">Reviews (Median)</th>
                <th className="py-2 px-3">Rating (Median)</th>

                <th className="py-2 px-3">ASIN Sum Umsatz</th>
                <th className="py-2 px-3">ASIN Sum Sales</th>

                <th className="py-2 px-3">Unmapped</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => {
                const prev = i > 0 ? months[i - 1] : null;
                const rMom = mom(m.parentRevenue, prev?.parentRevenue);
                const sMom = mom(m.parentSales, prev?.parentSales);
                const order3 = m.order3NodeId ? nodeById.get(m.order3NodeId) : null;
                const childDelta =
                    typeof m.childAsinCount === "number" && typeof prev?.childAsinCount === "number"
                        ? m.childAsinCount - prev.childAsinCount
                        : null;

                const leafChanged = prev?.leafString && m.leafString ? prev.leafString !== m.leafString : false;
                const order3Changed = prev?.order3NodeId && m.order3NodeId ? prev.order3NodeId !== m.order3NodeId : false;

                const driftWarn = leafChanged || order3Changed || (typeof childDelta === "number" && childDelta !== 0);


                return (
                  <tr key={m.month} className={`border-b last:border-0 ${driftWarn ? "bg-red-500/5" : ""}`}>
                    <td className="py-2 px-3 font-medium">{m.month}</td>

                    <td className={`py-2 px-3 ${order3Changed ? "text-red-400" : "opacity-80"}`}>
                        {order3 ? `${order3.path} — ${order3.name}` : "–"}
                        {order3Changed ? " ⚠️" : ""}
                    </td>

                    <td className={`py-2 px-3 ${leafChanged ? "text-red-400" : ""}`}>
                        {m.leafString ?? "–"}
                        {leafChanged ? " ⚠️" : ""}
                    </td>

                    <td className="py-2 px-3"><b>{eur(m.parentRevenue)}</b></td>
                    <td className="py-2 px-3">{pct(rMom)}</td>

                    <td className="py-2 px-3"><b>{num(m.parentSales)}</b></td>
                    <td className="py-2 px-3">{pct(sMom)}</td>

                    <td className="py-2 px-3">{num(m.childAsinCount)}</td>
                    <td className={`py-2 px-3 ${typeof childDelta === "number" && childDelta !== 0 ? "text-red-400" : ""}`}>
                        {typeof childDelta === "number" ? (childDelta > 0 ? `+${childDelta}` : `${childDelta}`) : "–"}
                        {typeof childDelta === "number" && childDelta !== 0 ? " ⚠️" : ""}
                    </td>

                    <td className="py-2 px-3">{eur(m.priceMedian)}</td>
                    <td className="py-2 px-3">{num(m.reviewsCountMedian)}</td>
                    <td className="py-2 px-3">
                        {typeof m.ratingMedian === "number" ? m.ratingMedian.toFixed(2) : "–"}
                    </td>

                    <td className="py-2 px-3">{eur(m.asinRevenueSum)}</td>
                    <td className="py-2 px-3">{num(m.asinSalesSum)}</td>

                    <td className="py-2 px-3">{m.isUnmapped ? "❌" : "✅"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer select-none font-medium">
          Child-ASINs anzeigen ({childAsins.length})
        </summary>
        <div className="mt-3 grid md:grid-cols-3 gap-2 text-sm">
          {childAsins.slice(0, 300).map((a) => (
            <a key={a} className="underline" href={amazonUrl(a)} target="_blank">{a}</a>
          ))}
          {childAsins.length > 300 ? (
            <div className="opacity-80">… (gekürzt, nur erste 300)</div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
