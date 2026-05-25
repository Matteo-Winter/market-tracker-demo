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
function amazonUrl(asin: string) {
  return `https://www.amazon.de/dp/${asin}`;
}

const COVERAGE_LOW_WARN = 0.3;   // <30% => sehr wahrscheinlich fehlen Childs im Export
const COVERAGE_HIGH_WARN = 1.2;  // >120% => verdächtig (Summe Child > Parent)
const SPREAD_WARN = 0.08;        // >8% Streuung in ParentRevenue/ParentSales in Child-Zeilen => verdächtig
const LEAF_MIX_WARN = 3;         // >= 3 unterschiedliche LeafStrings innerhalb Parent => quer gemischt

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

function sum(nums: Array<number | null | undefined>): number {
  return nums.reduce<number>((acc, v) => acc + (isNum(v) ? v : 0), 0);
}

function minmax(nums: (number | null | undefined)[]) {
  const a = nums.filter(isNum);
  if (!a.length) return { min: null as number | null, max: null as number | null };
  return { min: Math.min(...a), max: Math.max(...a) };
}

function topLeafInfo(values: (string | null | undefined)[]) {
  const freq = new Map<string, number>();
  for (const v0 of values) {
    const v = (v0 ?? "").trim();
    if (!v) continue;
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  return {
    distinct: freq.size,
    topName: top?.[0] ?? null,
    topCount: top?.[1] ?? 0,
  };
}

type SanityRow = {
  parentProductId: string;
  representativeAsin: string;
  representativeUrl: string | null;
  brandNorm: string | null;
  order3NodeId: string | null;

  parentRevenue: number | null;
  parentSales: number | null;
  asinRevenueSum: number | null;
  asinSalesSum: number | null;
  childAsinCount: number | null;

  isUnmapped: boolean;
  leafString: string | null;

  // computed
  kidsCount: number;
  childAsinRevenueSum: number;
  childAsinSalesSum: number;
  revenueCoverage: number | null;
  salesCoverage: number | null;

  revenueSpread: number | null;
  salesSpread: number | null;

  leafDistinct: number;
  leafTopName: string | null;
  leafTopShare: number | null;

  flags: string[];
};

export default async function SanityPage({
  params,
  searchParams,
}: {
  params: Promise<{ month: string; category2Id: string }>;
  searchParams?: Promise<{ onlyFlagged?: string; compareMonth?: string }>;
}) {
  const { month, category2Id } = await params;
  const sp = searchParams ? await searchParams : {};
  const onlyFlagged = (sp?.onlyFlagged ?? "1") !== "0";


  const compareMonthRaw = typeof sp?.compareMonth === "string" ? sp.compareMonth : null;
  const compareMonth =
    compareMonthRaw && /^\d{4}-\d{2}$/.test(compareMonthRaw) && compareMonthRaw !== month ? compareMonthRaw : null;

  // Für Links: immer gleich mitziehen (wenn gesetzt)
  const compareQ = compareMonth ? `&compareMonth=${encodeURIComponent(compareMonth)}` : "";

    

  if (!/^\d{4}-\d{2}$/.test(month)) notFound();

  const c2 = await prisma.category2.findUnique({
    where: { id: category2Id },
    include: { mainCategory: true },
  });
  if (!c2) notFound();

  // Rollups (Parent-Aggregate)
  const parents = await prisma.aggParentProductMonth.findMany({
    where: { month, category2Id },
    orderBy: [{ parentRevenue: "desc" }, { asinRevenueSum: "desc" }],
  });

  // Wenn noch keine Rollups existieren
  if (parents.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-sm opacity-80">{c2.mainCategory.name} → {c2.name}</div>
        <h1 className="text-2xl font-semibold">Sanity {month}</h1>
        <div className="rounded-xl border p-4">
          Keine Rollups gefunden. (Hast du <code>recomputeRollups.ts</code> für diesen Batch schon ausgeführt?)
        </div>
        <Link className="underline" href={`/rollups/${month}/${category2Id}`}>← zurück zum Rollup</Link>
      </div>
    );
  }

  // Child-Mappings + Child-Rows (für Spread/Leaf-Mix/echte ChildSum)
  const mappings = await prisma.childToParentMap.findMany({
    where: { month, category2Id },
    select: { parentProductId: true, childAsin: true },
  });

  const rows = await prisma.productRow.findMany({
    where: { month, category2Id },
    select: {
      asin: true,
      asinRevenue: true,
      asinSales: true,
      parentRevenue: true,
      parentSales: true,
      leafString: true,
    },
  });
  const rowByAsin = new Map(rows.map((r) => [r.asin, r]));

  const childrenByParent = new Map<string, string[]>();
  for (const m of mappings) {
    const arr = childrenByParent.get(m.parentProductId) ?? [];
    arr.push(m.childAsin);
    childrenByParent.set(m.parentProductId, arr);
  }

  // Order3 Node Names
  const order3Ids = [...new Set(parents.map((p) => p.order3NodeId).filter(Boolean))] as string[];
  const nodes = order3Ids.length
    ? await prisma.categoryNode.findMany({
        where: { id: { in: order3Ids } },
        select: { id: true, name: true, path: true },
      })
    : [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const sanityRows: SanityRow[] = parents.map((p) => {
    const kids = (childrenByParent.get(p.parentProductId) ?? []).sort();
    const childRows = kids.map((asin) => rowByAsin.get(asin)).filter(Boolean) as (typeof rows)[number][];

    const childAsinRevenueSum = sum(childRows.map((r) => r.asinRevenue));
    const childAsinSalesSum = sum(childRows.map((r) => r.asinSales));

    const parentRevenueMedian = p.parentRevenue;
    const parentSalesMedian = p.parentSales;

    const revenueCoverage =
      isNum(parentRevenueMedian) && parentRevenueMedian !== 0 ? childAsinRevenueSum / parentRevenueMedian : null;

    const salesCoverage =
      isNum(parentSalesMedian) && parentSalesMedian !== 0 ? childAsinSalesSum / parentSalesMedian : null;

    const pr = minmax(childRows.map((r) => r.parentRevenue));
    const ps = minmax(childRows.map((r) => r.parentSales));

    const revenueSpread = isNum(pr.min) && isNum(pr.max) && pr.max !== 0 ? (pr.max - pr.min) / pr.max : null;
    const salesSpread = isNum(ps.min) && isNum(ps.max) && ps.max !== 0 ? (ps.max - ps.min) / ps.max : null;

    const leaf = topLeafInfo(childRows.map((r) => r.leafString));
    const leafTopShare = childRows.length ? leaf.topCount / childRows.length : null;

    const flags: string[] = [];
    if (p.isUnmapped) flags.push("UNMAPPED");
    if (isNum(revenueCoverage) && revenueCoverage < COVERAGE_LOW_WARN) flags.push("COV_LOW");
    if (isNum(revenueCoverage) && revenueCoverage > COVERAGE_HIGH_WARN) flags.push("COV_HIGH");
    if (isNum(salesCoverage) && salesCoverage < COVERAGE_LOW_WARN) flags.push("COVS_LOW");
    if (isNum(salesCoverage) && salesCoverage > COVERAGE_HIGH_WARN) flags.push("COVS_HIGH");
    if (isNum(revenueSpread) && revenueSpread > SPREAD_WARN) flags.push("SPREAD_REV");
    if (isNum(salesSpread) && salesSpread > SPREAD_WARN) flags.push("SPREAD_SALES");
    if (leaf.distinct >= LEAF_MIX_WARN) flags.push("LEAF_MIX");

    return {
      parentProductId: p.parentProductId,
      representativeAsin: p.representativeAsin,
      representativeUrl: p.representativeUrl ?? null,
      brandNorm: p.brandNorm ?? null,
      order3NodeId: p.order3NodeId ?? null,

      parentRevenue: p.parentRevenue ?? null,
      parentSales: p.parentSales ?? null,
      asinRevenueSum: p.asinRevenueSum ?? null,
      asinSalesSum: p.asinSalesSum ?? null,
      childAsinCount: p.childAsinCount ?? null,

      isUnmapped: p.isUnmapped ?? false,
      leafString: p.leafString ?? null,

      kidsCount: kids.length,
      childAsinRevenueSum,
      childAsinSalesSum,
      revenueCoverage,
      salesCoverage,

      revenueSpread,
      salesSpread,

      leafDistinct: leaf.distinct,
      leafTopName: leaf.topName,
      leafTopShare,

      flags,
    };
  });

  const flagged = sanityRows.filter((r) => r.flags.length > 0);
  const unmappedCount = sanityRows.filter((r) => r.isUnmapped).length;

  const shown = onlyFlagged ? flagged : sanityRows;

  

  // sort: erst flagged, dann Umsatz desc
  shown.sort((a, b) => {
    const af = a.flags.length ? 1 : 0;
    const bf = b.flags.length ? 1 : 0;
    if (bf !== af) return bf - af;
    const ar = typeof a.parentRevenue === "number" ? a.parentRevenue : 0;
    const br = typeof b.parentRevenue === "number" ? b.parentRevenue : 0;
    return br - ar;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="space-y-1">
        <div className="text-sm opacity-80">{c2.mainCategory.name} → {c2.name}</div>
        <h1 className="text-2xl font-semibold">Sanity {month}</h1>
        {compareMonth ? (
          <div className="text-sm opacity-80">
            Vergleich: <b>{compareMonth}</b>
          </div>
        ) : null}

        <div className="flex gap-4 text-sm">
          <Link
            className="underline"
            href={`/rollups/${month}/${category2Id}${compareMonth ? `?compareMonth=${encodeURIComponent(compareMonth)}` : ""}`}
          >
            ← zurück
          </Link>
          <span className="opacity-60">|</span>
          {onlyFlagged ? (
            <Link className="underline" href={`/rollups/${month}/${category2Id}/sanity?onlyFlagged=0${compareQ}`}>
              Alle anzeigen
            </Link>
          ) : (
            <Link className="underline" href={`/rollups/${month}/${category2Id}/sanity?onlyFlagged=1${compareQ}`}>
              Nur Flagged anzeigen
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-xl border p-4 text-sm space-y-1">
        <div className="font-medium">Wie interpretieren?</div>
        <div className="opacity-80">
          <b>Coverage</b> = Summe Child-ASIN-Umsatz / Parent-Umsatz (median). Niedrig = vermutlich fehlen Varianten im Export. Hoch = verdächtig.
        </div>
        <div className="opacity-80">
          <b>Spread</b> = Streuung der ParentRevenue/ParentSales, die in den Child-Zeilen steht. Hoch = Helium10/CSV inkonsistent oder falsches Clustering.
        </div>
        <div className="opacity-80">
          <b>Leaf-Mix</b> = wie stark Childs über verschiedene Unterkategorien verteilt sind.
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="border-b">
            <tr className="text-left">
              <th className="py-2 px-3">Flags</th>
              <th className="py-2 px-3">Parent</th>
              <th className="py-2 px-3">Order3</th>
              <th className="py-2 px-3">Brand</th>
              <th className="py-2 px-3">Parent-Umsatz</th>
              <th className="py-2 px-3">Parent-Sales</th>
              <th className="py-2 px-3">Childs</th>
              <th className="py-2 px-3">Coverage (Rev)</th>
              <th className="py-2 px-3">Coverage (Sales)</th>
              <th className="py-2 px-3">Spread (Rev)</th>
              <th className="py-2 px-3">Spread (Sales)</th>
              <th className="py-2 px-3">Leaf-Mix</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const order3 = r.order3NodeId ? nodeById.get(r.order3NodeId) : null;
              const hasFlags = r.flags.length > 0;

              return (
                <tr key={r.parentProductId} className={`border-b last:border-0 ${hasFlags ? "bg-white/5" : ""}`}>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {r.flags.length ? (
                      <span className="text-red-400 font-medium">⚠️ {r.flags.join(", ")}</span>
                    ) : (
                      <span className="opacity-60">–</span>
                    )}
                  </td>

                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="flex flex-col">
                      <a className="underline" href={r.representativeUrl ?? amazonUrl(r.representativeAsin)} target="_blank">
                        {r.representativeAsin}
                      </a>
                      <Link className="underline opacity-80" href={`/rollups/${month}/${category2Id}`}>
                        Rollup öffnen
                      </Link>
                    </div>
                  </td>

                  <td className="py-2 px-3 whitespace-nowrap">
                    {order3 ? (
                      <span>{order3.path} — {order3.name}</span>
                    ) : (
                      <span className="opacity-60">–</span>
                    )}
                  </td>

                  <td className="py-2 px-3 whitespace-nowrap">{r.brandNorm ?? "–"}</td>

                  <td className="py-2 px-3 whitespace-nowrap">{eur(r.parentRevenue)}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{num(r.parentSales)}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{num(r.kidsCount)}</td>

                  <td className="py-2 px-3 whitespace-nowrap">{pct(r.revenueCoverage)}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{pct(r.salesCoverage)}</td>

                  <td className="py-2 px-3 whitespace-nowrap">{pct(r.revenueSpread)}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{pct(r.salesSpread)}</td>

                  <td className="py-2 px-3">
                    <div className="whitespace-nowrap">
                      <b>{r.leafDistinct}</b>
                      {r.leafTopName ? (
                        <span className="opacity-80"> · Top: {r.leafTopName} ({pct(r.leafTopShare)})</span>
                      ) : null}
                    </div>
                    <div className="opacity-70">gewählt: {r.leafString ?? "–"}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
