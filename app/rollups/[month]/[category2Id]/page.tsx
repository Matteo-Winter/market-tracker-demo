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
  return `${Math.round(n * 100)}%`;
}

function pctSigned(n: number | null | undefined) {
  if (typeof n !== "number") return "–";
  const sign = n > 0 ? "+" : "";
  return `${sign}${Math.round(n * 100)}%`;
}

function mom(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (typeof cur !== "number" || typeof prev !== "number") return null;
  if (prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
}

function amazonUrl(asin: string) {
  return `https://www.amazon.de/dp/${asin}`;
}

const COVERAGE_LOW_WARN = 0.3; // <30%: wahrscheinlich fehlen viele Childs im Upload (oder Mapping falsch)
const COVERAGE_HIGH_WARN = 1.2; // >120%: verdächtig (Summe Child > Parent)
const SPREAD_WARN = 0.08; // >8% Streuung bei ParentRevenue/ParentSales innerhalb der Childs => verdächtig

const isNum = (x: any): x is number => typeof x === "number" && Number.isFinite(x);

function sum(nums: (number | null | undefined)[]) {
  return nums.reduce<number>((acc, v) => acc + (isNum(v) ? v : 0), 0);
}
function minmax(nums: (number | null | undefined)[]) {
  const a = nums.filter(isNum);
  if (!a.length) return { min: null as number | null, max: null as number | null };
  return { min: Math.min(...a), max: Math.max(...a) };
}

type Props = {
  params: Promise<{ month: string; category2Id: string }>;
  searchParams?: Promise<{ compareMonth?: string }>;
};

export default async function RollupDetailPage({ params, searchParams }: Props) {
  const { month, category2Id } = await params;
  const sp = searchParams ? await searchParams : {};
  const compareMonthRaw = typeof sp?.compareMonth === "string" ? sp.compareMonth : null;

  if (!/^\d{4}-\d{2}$/.test(month)) notFound();

  const compareMonth =
    compareMonthRaw && /^\d{4}-\d{2}$/.test(compareMonthRaw) && compareMonthRaw !== month
      ? compareMonthRaw
      : null;

  const compareQ = compareMonth ? `?compareMonth=${encodeURIComponent(compareMonth)}` : "";

  const c2 = await prisma.category2.findUnique({
    where: { id: category2Id },
    include: { mainCategory: true },
  });
  if (!c2) notFound();

  const parents = await prisma.aggParentProductMonth.findMany({
    where: { month, category2Id },
    orderBy: [{ parentRevenue: "desc" }, { asinRevenueSum: "desc" }],
  });

  const prevParents = compareMonth
    ? await prisma.aggParentProductMonth.findMany({
        where: { month: compareMonth, category2Id },
        select: {
          parentProductId: true,
          parentRevenue: true,
          parentSales: true,
          childAsinCount: true,
          priceMedian: true,
          reviewsCountMedian: true,
          ratingMedian: true,
        },
      })
    : [];

  const prevByParentId = new Map(prevParents.map((p) => [p.parentProductId, p]));

  const mappings = await prisma.childToParentMap.findMany({
    where: { month, category2Id },
    select: { parentProductId: true, childAsin: true },
  });

  const rows = await prisma.productRow.findMany({
    where: { month, category2Id },
    select: {
      asin: true,
      title: true,
      brand: true,
      price: true,
      asinRevenue: true,
      asinSales: true,
      parentRevenue: true,
      parentSales: true,
      reviewsCount: true,
      rating: true,
      leafString: true,
    },
  });

  const rowByAsin = new Map(rows.map((r) => [r.asin, r]));

  // children pro parent
  const childrenByParent = new Map<string, string[]>();
  for (const m of mappings) {
    const arr = childrenByParent.get(m.parentProductId) ?? [];
    arr.push(m.childAsin);
    childrenByParent.set(m.parentProductId, arr);
  }

  // Node-Namen für Order3
  const order3Ids = [...new Set(parents.map((p) => p.order3NodeId).filter(Boolean))] as string[];
  const nodes = order3Ids.length
    ? await prisma.categoryNode.findMany({
        where: { id: { in: order3Ids } },
        select: { id: true, name: true, path: true },
      })
    : [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const totalRevenue = parents.reduce((acc, p) => acc + (typeof p.parentRevenue === "number" ? p.parentRevenue : 0), 0);
  const totalSales = parents.reduce((acc, p) => acc + (typeof p.parentSales === "number" ? p.parentSales : 0), 0);

  const prevTotalRevenue = prevParents.reduce((acc, p) => acc + (typeof p.parentRevenue === "number" ? p.parentRevenue : 0), 0);
  const prevTotalSales = prevParents.reduce((acc, p) => acc + (typeof p.parentSales === "number" ? p.parentSales : 0), 0);

  const curSet = new Set(parents.map((p) => p.parentProductId));
  const prevSet = new Set(prevParents.map((p) => p.parentProductId));
  const newParents = compareMonth ? parents.filter((p) => !prevSet.has(p.parentProductId)).length : 0;
  const droppedParents = compareMonth ? prevParents.filter((p) => !curSet.has(p.parentProductId)).length : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <div className="text-sm opacity-80">
          {c2.mainCategory.name} → {c2.name}
        </div>

        <h1 className="text-2xl font-semibold">Rollup {month}</h1>

        <div className="text-sm opacity-80">
          Parents: <b>{parents.length}</b> · Umsatz (Summe Parent): <b>{eur(totalRevenue)}</b> · Verkäufe (Summe Parent):{" "}
          <b>{num(totalSales)}</b>
        </div>

        <div className="text-sm opacity-80">
          Vergleich:{" "}
          {compareMonth ? (
            <>
              <b>{compareMonth}</b> · MoM Umsatz: <b>{pctSigned(mom(totalRevenue, prevTotalRevenue))}</b> · MoM Sales:{" "}
              <b>{pctSigned(mom(totalSales, prevTotalSales))}</b> · NEW: <b>{newParents}</b> · Dropped: <b>{droppedParents}</b>{" "}
              ·{" "}
              <Link className="underline" href={`/rollups/${compareMonth}/${category2Id}`}>
                Vergleichs-Rollup öffnen
              </Link>
            </>
          ) : (
            <span className="opacity-80">kein (füge ?compareMonth=YYYY-MM an die URL an)</span>
          )}
        </div>

        <div className="text-sm flex gap-3">
          <Link className="underline" href="/rollups">
            ← zurück
          </Link>
          <span className="opacity-60">|</span>
          <Link className="underline" href={`/rollups/${month}/${category2Id}/sanity${compareQ}`}>
            Sanity öffnen →
          </Link>
        </div>
      </div>

      {parents.length === 0 ? (
        <div className="rounded-xl border p-4">
          Keine Rollups gefunden. (Hast du `recomputeRollups.ts` für diesen Monat+Category2 schon laufen lassen?)
        </div>
      ) : null}

      <div className="space-y-3">
        {parents.map((p) => {
          const kids = (childrenByParent.get(p.parentProductId) ?? []).sort();
          const order3 = p.order3NodeId ? nodeById.get(p.order3NodeId) : null;
          const childRows = kids.map((asin) => rowByAsin.get(asin)).filter(Boolean) as (typeof rows)[number][];

          const priceMinMax = minmax(childRows.map((r) => r.price));
          const priceSpread =
            isNum(priceMinMax.min) && isNum(priceMinMax.max) && priceMinMax.max !== 0
              ? (priceMinMax.max - priceMinMax.min) / priceMinMax.max
              : null;
          const warnPriceSpread = isNum(priceSpread) && priceSpread > 0.25; // 25%+

          const childAsinRevenueSum = sum(childRows.map((r) => r.asinRevenue));
          const childAsinSalesSum = sum(childRows.map((r) => r.asinSales));

          const pr = minmax(childRows.map((r) => r.parentRevenue));
          const ps = minmax(childRows.map((r) => r.parentSales));
          const parentRevenueMedian = p.parentRevenue; // kommt aus Agg (median)
          const parentSalesMedian = p.parentSales; // kommt aus Agg (median)

          const revenueCoverage =
            isNum(parentRevenueMedian) && parentRevenueMedian !== 0 ? childAsinRevenueSum / parentRevenueMedian : null;

          const salesCoverage =
            isNum(parentSalesMedian) && parentSalesMedian !== 0 ? childAsinSalesSum / parentSalesMedian : null;

          const revenueSpread =
            isNum(pr.min) && isNum(pr.max) && pr.max !== 0 ? (pr.max - pr.min) / pr.max : null;

          const salesSpread =
            isNum(ps.min) && isNum(ps.max) && ps.max !== 0 ? (ps.max - ps.min) / ps.max : null;

          const leafFreq = new Map<string, number>();
          for (const r of childRows) {
            const s = r.leafString ?? "";
            if (!s) continue;
            leafFreq.set(s, (leafFreq.get(s) ?? 0) + 1);
          }
          const topLeaf = [...leafFreq.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
          const distinctLeafs = leafFreq.size;
          const topLeafShare = topLeaf ? topLeaf[1] / Math.max(1, childRows.length) : null;

          const warnCoverage =
            isNum(revenueCoverage) && (revenueCoverage < COVERAGE_LOW_WARN || revenueCoverage > COVERAGE_HIGH_WARN);

          const warnSpread =
            (isNum(revenueSpread) && revenueSpread > SPREAD_WARN) || (isNum(salesSpread) && salesSpread > SPREAD_WARN);

          const warnLeafMix = distinctLeafs >= 3;

          const revRatio =
            typeof p.parentRevenue === "number" && p.parentRevenue !== 0 ? (p.asinRevenueSum ?? 0) / p.parentRevenue : null;

          const salesRatio =
            typeof p.parentSales === "number" && p.parentSales !== 0 ? (p.asinSalesSum ?? 0) / p.parentSales : null;

          const prev = compareMonth ? prevByParentId.get(p.parentProductId) : null;
          const momRev = mom(p.parentRevenue, prev?.parentRevenue);
          const momSales = mom(p.parentSales, prev?.parentSales);

          const isNew = compareMonth ? !prev : false;

          return (
            <details key={p.parentProductId} className="rounded-xl border p-4">
              <summary className="cursor-pointer select-none">
                <div className="flex flex-col gap-1">
                  <div className="text-sm opacity-80">
                    Order3: {order3 ? `${order3.path} — ${order3.name}` : "–"} · Brand: {p.brandNorm ?? "–"}
                    {isNew ? <span className="ml-2 text-emerald-400 font-medium">NEW</span> : null}
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <div className="font-medium">
                      Parent:{" "}
                      <a className="underline" href={p.representativeUrl ?? amazonUrl(p.representativeAsin)} target="_blank">
                        {p.representativeAsin}
                      </a>
                      <Link className="underline ml-2" href={`/parents/${p.parentProductId}`}>
                        (History)
                      </Link>
                    </div>

                    <div>
                      Parent-Umsatz: <b>{eur(p.parentRevenue)}</b>
                      {compareMonth ? (
                        <span className="ml-2 opacity-80">MoM: <b>{pctSigned(momRev)}</b></span>
                      ) : null}
                    </div>

                    <div>
                      Parent-Verkäufe: <b>{num(p.parentSales)}</b>
                      {compareMonth ? (
                        <span className="ml-2 opacity-80">MoM: <b>{pctSigned(momSales)}</b></span>
                      ) : null}
                    </div>

                    <div>
                      Child-ASINs: <b>{kids.length}</b>
                      {compareMonth && prev ? (
                        <span className="ml-2 opacity-80">
                          Δ: <b>{typeof prev.childAsinCount === "number" ? kids.length - prev.childAsinCount : "–"}</b>
                        </span>
                      ) : null}
                    </div>

                    <div className="opacity-80">
                      Check Umsatz (ChildSum/Parent): <b>{pct(revRatio)}</b> · Check Sales: <b>{pct(salesRatio)}</b>
                    </div>
                  </div>
                </div>
              </summary>

              <div className="mt-4 space-y-2">
                <div className="text-sm opacity-80">
                  Leaf (gewählt): {p.leafString ?? "–"} {p.isUnmapped ? "❌ unmapped" : "✅ mapped"}
                </div>

                <div className="mt-2 rounded-lg border p-3 text-sm space-y-1">
                  <div className="font-medium">QA / Plausibilität</div>

                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <div>
                      ChildSum Umsatz: <b>{eur(childAsinRevenueSum)}</b> · Parent-Umsatz (median): <b>{eur(parentRevenueMedian)}</b>{" "}
                      · Coverage:{" "}
                      <b className={warnCoverage ? "text-red-400" : ""}>{pct(revenueCoverage)}</b>
                      {warnCoverage ? " ⚠️" : ""}
                    </div>

                    <div>
                      ChildSum Sales: <b>{num(childAsinSalesSum)}</b> · Parent-Sales (median): <b>{num(parentSalesMedian)}</b> ·
                      Coverage: <b>{pct(salesCoverage)}</b>
                    </div>

                    <div>
                      ParentRevenue in Child-Zeilen: min <b>{eur(pr.min)}</b> / max <b>{eur(pr.max)}</b> · Spread:{" "}
                      <b className={warnSpread ? "text-red-400" : ""}>{pct(revenueSpread)}</b>
                      {warnSpread ? " ⚠️" : ""}
                    </div>

                    <div>
                      Preis-Range: <b>{eur(priceMinMax.min)}</b> – <b>{eur(priceMinMax.max)}</b> · Spread:{" "}
                      <b className={warnPriceSpread ? "text-red-400" : ""}>{pct(priceSpread)}</b>
                      {warnPriceSpread ? " ⚠️" : ""}
                    </div>

                    <div>
                      Leaf-Mix: <b>{distinctLeafs}</b>
                      {topLeaf ? (
                        <>
                          {" "}
                          · Top: <b>{topLeaf[0]}</b> ({pct(topLeafShare)})
                        </>
                      ) : null}
                      {warnLeafMix ? " ⚠️" : ""}
                    </div>
                  </div>

                  <div className="opacity-80">
                    Hinweis: niedrige Coverage kann bedeuten, dass nicht alle Varianten (Childs) dieses Parents im CSV-Export enthalten sind.
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-left">
                        <th className="py-2 pr-4">Child ASIN</th>
                        <th className="py-2 pr-4">Titel</th>
                        <th className="py-2 pr-4">Preis</th>
                        <th className="py-2 pr-4">ASIN-Umsatz</th>
                        <th className="py-2 pr-4">ASIN-Verkäufe</th>
                        <th className="py-2 pr-4">Reviews</th>
                        <th className="py-2 pr-4">Rating</th>
                        <th className="py-2 pr-4">Unterkategorie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kids.map((asin) => {
                        const r = rowByAsin.get(asin);
                        return (
                          <tr key={asin} className="border-b last:border-0">
                            <td className="py-2 pr-4">
                              <a className="underline" href={amazonUrl(asin)} target="_blank">
                                {asin}
                              </a>
                            </td>
                            <td className="py-2 pr-4">{r?.title ?? "–"}</td>
                            <td className="py-2 pr-4">{eur(r?.price)}</td>
                            <td className="py-2 pr-4">{eur(r?.asinRevenue)}</td>
                            <td className="py-2 pr-4">{num(r?.asinSales)}</td>
                            <td className="py-2 pr-4">{num(r?.reviewsCount)}</td>
                            <td className="py-2 pr-4">{typeof r?.rating === "number" ? r.rating.toFixed(2) : "–"}</td>
                            <td className="py-2 pr-4">{r?.leafString ?? "–"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
