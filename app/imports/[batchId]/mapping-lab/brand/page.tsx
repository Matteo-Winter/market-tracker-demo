import Link from "next/link";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<{
  brand?: string;
  section?: string;
  q?: string;
}>;

type Params = Promise<{ batchId: string }>;

type ChildRow = {
  asin: string;
  title: string | null;
  brand: string | null;
  brandNorm: string | null;
  imageUrl: string | null;
  leafString: string | null;
  price: number | null;
  parentRevenue: number | null;
  parentSales: number | null;
  asinRevenue: number | null;
  asinSales: number | null;
  reviewsCount: number | null;
  rating: number | null;
  bsr: number | null;
  subcatBsr: number | null;
  ean: string | null;
  gtin: string | null;
  upc: string | null;
  isbn: string | null;
};

type BrandOption = {
  brandNorm: string;
  displayBrand: string;
  count: number;
};

type GroupKind = "auto" | "candidate" | "unsorted";

type GroupCard = {
  parentProductId: string | null;
  representativeAsin: string | null;
  representativeUrl: string | null;
  method: string | null;
  kind: GroupKind;
  title: string | null;
  imageUrl: string | null;
  brand: string | null;
  leafString: string | null;
  parentRevenue: number | null;
  reviewsCount: number | null;
  rating: number | null;
  childCount: number;
  overlapCount: number;
  overlapLabels: string[];
  signals: string[];
  children: ChildRow[];
};

function euro(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function dec(n?: number | null, digits = 2) {
  if (n == null || Number.isNaN(n)) return "–";
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

function intFmt(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "–";
  return new Intl.NumberFormat("de-DE").format(n);
}

function norm(s: string | null | undefined) {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " und ")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function cleanCode(s: string | null | undefined) {
  const v = (s ?? "").trim();
  return v ? v.replace(/[^0-9A-Za-z]/g, "") : "";
}

function titleTokens(title: string | null | undefined) {
  return norm(title)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function titleSimilarity(a: string | null | undefined, b: string | null | undefined) {
  const sa = new Set(titleTokens(a));
  const sb = new Set(titleTokens(b));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / new Set([...sa, ...sb]).size;
}

function within(a?: number | null, b?: number | null, tol = 0.07) {
  if (a == null || b == null) return false;
  if (a === 0 || b === 0) return a === b;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) <= tol;
}

function summarizeSignals(children: ChildRow[]) {
  const signals: string[] = [];
  const codes = new Set<string>();
  const images = new Set<string>();
  const revs = new Set<number>();
  const ratings = new Set<number>();
  const parentMetrics = new Set<string>();
  const leafs = new Set<string>();

  for (const c of children) {
    for (const code of [c.ean, c.gtin, c.upc, c.isbn]) {
      const cc = cleanCode(code);
      if (cc) codes.add(cc);
    }
    if (c.imageUrl) images.add(c.imageUrl);
    if (c.reviewsCount != null) revs.add(c.reviewsCount);
    if (c.rating != null) ratings.add(Number(c.rating.toFixed(2)));
    if (c.parentRevenue != null && c.parentSales != null) {
      parentMetrics.add(`${c.parentRevenue.toFixed(2)}|${c.parentSales}`);
    }
    if (c.leafString) leafs.add(norm(c.leafString));
  }

  if (codes.size > 0) signals.push("Code vorhanden");
  if (images.size === 1 && children.length > 1) signals.push("gleiches Bild");
  if (parentMetrics.size === 1 && children.length > 1) signals.push("gleiche Parent-Werte");
  if (revs.size === 1 && ratings.size === 1 && children.length > 1) signals.push("gleiche Reviews + Rating");
  if (leafs.size === 1 && children.length > 1) signals.push("gleicher Leaf");

  return signals;
}

function classifyGroup(children: ChildRow[]) {
  if (children.length <= 1) return "unsorted" as GroupKind;

  const exactParent = new Set(
    children
      .filter((c) => c.parentRevenue != null && c.parentSales != null)
      .map((c) => `${c.parentRevenue!.toFixed(2)}|${c.parentSales}`),
  ).size === 1;

  const exactReviewsRating =
    new Set(children.filter((c) => c.reviewsCount != null).map((c) => c.reviewsCount)).size === 1 &&
    new Set(children.filter((c) => c.rating != null).map((c) => Number(c.rating!.toFixed(2)))).size === 1;

  const imageSame = new Set(children.map((c) => c.imageUrl).filter(Boolean)).size === 1;

  const codes = new Map<string, number>();
  for (const c of children) {
    for (const code of [c.ean, c.gtin, c.upc, c.isbn]) {
      const cc = cleanCode(code);
      if (!cc) continue;
      codes.set(cc, (codes.get(cc) ?? 0) + 1);
    }
  }
  const hasSharedCode = [...codes.values()].some((count) => count >= 2);

  if (hasSharedCode || imageSame || exactParent) return "auto";
  if (exactReviewsRating) return "candidate";

  const first = children[0];
  const titleNear = children.every((c) => titleSimilarity(first.title, c.title) >= 0.55);
  const revenueNear = children.every((c) => within(first.parentRevenue, c.parentRevenue, 0.07));
  const salesNear = children.every((c) => within(first.parentSales, c.parentSales, 0.07));
  if (titleNear && (revenueNear || salesNear)) return "candidate";

  return "candidate";
}

function bestRepresentative(children: ChildRow[]) {
  return [...children].sort((a, b) => (b.asinRevenue ?? -1) - (a.asinRevenue ?? -1))[0] ?? children[0];
}

function topValue<T>(items: T[], getter: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const val = getter(item)?.trim();
    if (!val) continue;
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function aggregate(children: ChildRow[]) {
  const rep = bestRepresentative(children);
  const title = rep.title ?? topValue(children, (c) => c.title);
  const imageUrl = rep.imageUrl ?? topValue(children, (c) => c.imageUrl);
  const leafString = topValue(children, (c) => c.leafString);
  const parentRevenue = Math.max(...children.map((c) => c.parentRevenue ?? 0));
  const reviewsCount = Math.max(...children.map((c) => c.reviewsCount ?? 0));
  const rating = rep.rating ?? children.find((c) => c.rating != null)?.rating ?? null;

  return {
    title,
    imageUrl,
    leafString,
    parentRevenue: parentRevenue || null,
    reviewsCount: reviewsCount || null,
    rating,
  };
}

function amazonUrl(asin: string | null | undefined, url: string | null | undefined) {
  const raw = (url ?? "").trim();
  if (raw) return raw;
  const cleanAsin = (asin ?? "").trim();
  return cleanAsin ? `https://www.amazon.de/dp/${encodeURIComponent(cleanAsin)}` : null;
}

function matchesQuery(group: GroupCard, qNorm: string) {
  if (!qNorm) return true;
  const hay = [
    group.title,
    group.representativeAsin,
    group.leafString,
    group.brand,
    ...group.children.flatMap((child) => [child.asin, child.title, child.leafString]),
  ]
    .filter(Boolean)
    .map((v) => norm(v))
    .join(" | ");
  return hay.includes(qNorm);
}

export default async function MappingLabBrandPage(props: {
  params: Params;
  searchParams: SearchParams;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const section = searchParams.section === "details" ? "details" : "compact";
  const query = (searchParams.q ?? "").trim();
  const queryNorm = norm(query);

  const batch = await prisma.importBatch.findUnique({
    where: { id: params.batchId },
    include: {
      category2: { include: { mainCategory: true } },
    },
  });

  if (!batch) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-sm text-neutral-200">
        Batch nicht gefunden.
      </div>
    );
  }

  const brandRows = await prisma.productRow.findMany({
    where: { batchId: batch.id },
    select: { brand: true, brandNorm: true, asin: true },
  });

  const brandMap = new Map<string, BrandOption>();
  for (const row of brandRows) {
    const brandNorm = row.brandNorm ?? "__ohne_marke__";
    const displayBrand = row.brand?.trim() || "Ohne Marke";
    const prev = brandMap.get(brandNorm);
    if (prev) prev.count += 1;
    else brandMap.set(brandNorm, { brandNorm, displayBrand, count: 1 });
  }

  const brands = [...brandMap.values()].sort((a, b) => b.count - a.count || a.displayBrand.localeCompare(b.displayBrand, "de"));
  const selectedBrand = searchParams.brand && brandMap.has(searchParams.brand) ? searchParams.brand : brands[0]?.brandNorm ?? null;

  let groupCards: GroupCard[] = [];

  if (selectedBrand) {
    const rows = await prisma.productRow.findMany({
      where: {
        batchId: batch.id,
        ...(selectedBrand === "__ohne_marke__" ? { brandNorm: null } : { brandNorm: selectedBrand }),
      },
      orderBy: [{ asinRevenue: "desc" }, { asin: "asc" }],
      select: {
        asin: true,
        title: true,
        brand: true,
        brandNorm: true,
        imageUrl: true,
        leafString: true,
        price: true,
        parentRevenue: true,
        parentSales: true,
        asinRevenue: true,
        asinSales: true,
        reviewsCount: true,
        rating: true,
        bsr: true,
        subcatBsr: true,
        ean: true,
        gtin: true,
        upc: true,
        isbn: true,
      },
    });

    const asins = rows.map((r) => r.asin);

    const maps = asins.length
      ? await prisma.childToParentMap.findMany({
          where: {
            month: batch.month ?? undefined,
            category2Id: batch.category2Id,
            childAsin: { in: asins },
          },
          select: {
            childAsin: true,
            parentProductId: true,
            representativeAsin: true,
            method: true,
          },
        })
      : [];

    const parentIds = [...new Set(maps.map((m) => m.parentProductId).filter(Boolean))] as string[];
    const parents = parentIds.length
      ? await prisma.parentProduct.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, representativeUrl: true },
        })
      : [];

    const parentUrlById = new Map(parents.map((p) => [p.id, p.representativeUrl]));
    const mapByAsin = new Map(maps.map((m) => [m.childAsin, m]));

    const sameAsinOtherBatches = asins.length && batch.month
      ? await prisma.productRow.findMany({
          where: {
            asin: { in: asins },
            month: batch.month,
            NOT: { batchId: batch.id },
            category2: { mainCategoryId: batch.category2.mainCategoryId },
          },
          select: {
            asin: true,
            batchId: true,
            month: true,
            leafString: true,
            category2Id: true,
            category2: { select: { name: true } },
          },
        })
      : [];

    const overlapByAsin = new Map<string, { count: number; labels: string[] }>();
    for (const row of sameAsinOtherBatches) {
      const label = [row.month, row.category2.name, row.leafString].filter(Boolean).join(" • ");
      const prev = overlapByAsin.get(row.asin) ?? { count: 0, labels: [] };
      prev.count += 1;
      if (label && prev.labels.length < 4 && !prev.labels.includes(label)) prev.labels.push(label);
      overlapByAsin.set(row.asin, prev);
    }

    const grouped = new Map<string, ChildRow[]>();
    for (const row of rows) {
      const map = mapByAsin.get(row.asin);
      const key = map?.parentProductId ? `parent:${map.parentProductId}` : `single:${row.asin}`;
      const arr = grouped.get(key) ?? [];
      arr.push(row);
      grouped.set(key, arr);
    }

    groupCards = [...grouped.entries()].map(([, children]) => {
      const rep = bestRepresentative(children);
      const map = mapByAsin.get(rep.asin) ?? null;
      const kind = classifyGroup(children);
      const agg = aggregate(children);
      const overlapSet = new Map<string, true>();
      let overlapCount = 0;
      for (const child of children) {
        const overlap = overlapByAsin.get(child.asin);
        if (!overlap) continue;
        overlapCount += overlap.count;
        for (const label of overlap.labels) overlapSet.set(label, true);
      }

      return {
        parentProductId: map?.parentProductId ?? null,
        representativeAsin: map?.representativeAsin ?? rep.asin,
        representativeUrl: map?.parentProductId ? parentUrlById.get(map.parentProductId) ?? null : null,
        method: map?.method ?? null,
        kind,
        title: agg.title,
        imageUrl: agg.imageUrl,
        brand: rep.brand,
        leafString: agg.leafString,
        parentRevenue: agg.parentRevenue,
        reviewsCount: agg.reviewsCount,
        rating: agg.rating,
        childCount: children.length,
        overlapCount,
        overlapLabels: [...overlapSet.keys()],
        signals: summarizeSignals(children),
        children: children.sort((a, b) => (b.asinRevenue ?? 0) - (a.asinRevenue ?? 0)),
      } satisfies GroupCard;
    });

    groupCards.sort((a, b) => (b.parentRevenue ?? 0) - (a.parentRevenue ?? 0) || b.childCount - a.childCount);
  }

  const autoGroups = groupCards.filter((g) => g.kind === "auto");
  const candidateGroups = groupCards.filter((g) => g.kind === "candidate");
  const unsortedGroups = groupCards.filter((g) => g.kind === "unsorted");
  const filteredUnsortedGroups = unsortedGroups.filter((group) => matchesQuery(group, queryNorm));

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-[1700px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-neutral-500">Mapping Lab — Markenansicht</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {batch.category2.mainCategory.name} · {batch.category2.name}
            </h1>
            <div className="mt-1 text-sm text-neutral-400">
              Batch {batch.id.slice(0, 8)} · Monat {batch.month ?? "–"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href={`/imports/${batch.id}`}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-800"
            >
              Zurück zum Batch
            </Link>
            <Link
              href={`/imports/${batch.id}/mapping-lab`}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-800"
            >
              Zur normalen Mapping-Lab-Seite
            </Link>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4">
          <form className="grid gap-3 lg:grid-cols-[minmax(280px,420px)_auto] lg:items-end">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
                Marke auswählen
              </label>
              <select
                name="brand"
                defaultValue={selectedBrand ?? undefined}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-3 text-sm outline-none ring-0 transition focus:border-neutral-600"
              >
                {brands.map((brand) => (
                  <option key={brand.brandNorm} value={brand.brandNorm}>
                    {brand.displayBrand} ({brand.count})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <input type="hidden" name="section" value={section} />
              <button className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-200">
                Marke laden
              </button>
              <Link
                href={`/imports/${batch.id}/mapping-lab/brand?brand=${encodeURIComponent(selectedBrand ?? "")}&section=${section === "compact" ? "details" : "compact"}&q=${encodeURIComponent(query)}`}
                className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900"
              >
                {section === "compact" ? "Mehr Infos einblenden" : "Weniger Infos zeigen"}
              </Link>
            </div>
          </form>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <StatCard label="Auto-Gruppen" value={String(autoGroups.length)} hint="stark vorsortiert" />
            <StatCard label="Kandidaten-Gruppen" value={String(candidateGroups.length)} hint="prüfbare Familien" />
            <StatCard label="Unsortiert" value={String(unsortedGroups.length)} hint="noch kein guter Nachbar" />
            <StatCard label="Brand-Childs" value={String(groupCards.reduce((sum, g) => sum + g.childCount, 0))} hint="nur diese Marke" />
          </div>
        </div>

        {!selectedBrand ? (
          <div className="rounded-2xl border border-dashed border-neutral-800 p-8 text-center text-neutral-400">
            Keine Marke gefunden.
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Links: bereits vorsortierte Familien</h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      Auto = sehr sicher. Kandidat = wahrscheinlich zusammengehörig, aber noch prüfbar.
                    </p>
                  </div>
                  <div className="text-sm text-neutral-400">{brands.find((b) => b.brandNorm === selectedBrand)?.displayBrand}</div>
                </div>

                <div className="space-y-4">
                  <GroupSection title="Auto" tone="green" groups={autoGroups} section={section} batchId={batch.id} />
                  <GroupSection title="Kandidat" tone="amber" groups={candidateGroups} section={section} batchId={batch.id} />
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                <div className="mb-3">
                  <h2 className="text-lg font-semibold">Rechts: übrige nicht vorsortierte Produkte</h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    Das sind die Produkte dieser Marke, die aktuell keinen starken Cluster haben. Hier findest du die Lücken im Mapping.
                  </p>
                </div>

                <form className="mb-4 flex flex-wrap gap-2">
                  <input type="hidden" name="brand" value={selectedBrand ?? ""} />
                  <input type="hidden" name="section" value={section} />
                  <input
                    type="text"
                    name="q"
                    defaultValue={query}
                    placeholder="Bei übrigen Produkten suchen: ASIN, Titel, Leaf …"
                    className="min-w-[240px] flex-1 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-600"
                  />
                  <button className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200">
                    Suchen
                  </button>
                  {query ? (
                    <Link
                      href={`/imports/${batch.id}/mapping-lab/brand?brand=${encodeURIComponent(selectedBrand ?? "")}&section=${section}`}
                      className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900"
                    >
                      Suche löschen
                    </Link>
                  ) : null}
                </form>

                {unsortedGroups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-800 p-4 text-sm text-neutral-400">
                    Für diese Marke ist aktuell nichts mehr im Rest.
                  </div>
                ) : filteredUnsortedGroups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-800 p-4 text-sm text-neutral-400">
                    Keine übrigen Produkte passen auf deine Suche.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredUnsortedGroups.map((group) => (
                      <ProductGroupCard key={`${group.parentProductId ?? group.representativeAsin ?? group.title}-unsorted`} group={group} tone="slate" section={section} batchId={batch.id} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-neutral-400">{hint}</div>
    </div>
  );
}

function GroupSection({
  title,
  tone,
  groups,
  section,
  batchId,
}: {
  title: string;
  tone: "green" | "amber";
  groups: GroupCard[];
  section: "compact" | "details";
  batchId: string;
}) {
  const toneMap = {
    green: "border-emerald-900/60 bg-emerald-950/30",
    amber: "border-amber-900/60 bg-amber-950/30",
  } as const;

  return (
    <div className={`rounded-xl border p-3 ${toneMap[tone]}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-white">
          {title} <span className="text-neutral-400">({groups.length})</span>
        </div>
        <Link href={`/imports/${batchId}/mapping-lab`} className="text-xs text-neutral-400 underline-offset-4 hover:underline">
          zurück zur Gesamtansicht
        </Link>
      </div>
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-800 p-3 text-sm text-neutral-400">Keine Gruppen in diesem Bereich.</div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <ProductGroupCard key={`${group.parentProductId ?? group.representativeAsin ?? group.title}-${title}`} group={group} tone={tone} section={section} batchId={batchId} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductGroupCard({
  group,
  tone,
  section,
  batchId,
}: {
  group: GroupCard;
  tone: "green" | "amber" | "slate";
  section: "compact" | "details";
  batchId: string;
}) {
  const toneClass = {
    green: "border-emerald-900/40 bg-neutral-950/70",
    amber: "border-amber-900/40 bg-neutral-950/70",
    slate: "border-neutral-800 bg-neutral-950/70",
  } as const;

  const repAmazonUrl = amazonUrl(group.representativeAsin, group.representativeUrl);

  return (
    <div className={`rounded-xl border ${toneClass[tone]} p-3`}>
      <div className="grid gap-3 md:grid-cols-[84px_minmax(0,1fr)]">
        <div className="h-[84px] w-[84px] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
          {group.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.imageUrl} alt={group.title ?? group.representativeAsin ?? "Produkt"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-neutral-500">Kein Bild</div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold leading-5 text-white">{group.title ?? "Ohne Titel"}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-400">
                <span>{group.brand ?? "Ohne Marke"}</span>
                {group.leafString ? <span>• {group.leafString}</span> : null}
                {group.representativeAsin ? <span>• Rep ASIN: {group.representativeAsin}</span> : null}
                <span>• {group.childCount} Child{group.childCount === 1 ? "" : "s"}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-neutral-800 px-2.5 py-1 text-neutral-300">Parent-Umsatz {euro(group.parentRevenue)}</span>
              <span className="rounded-full border border-neutral-800 px-2.5 py-1 text-neutral-300">Reviews {intFmt(group.reviewsCount)}</span>
              <span className="rounded-full border border-neutral-800 px-2.5 py-1 text-neutral-300">Rating {dec(group.rating)}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-400">
            {group.signals.map((signal) => (
              <span key={signal} className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1">
                {signal}
              </span>
            ))}
            {group.method ? (
              <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1">
                Methode {group.method}
              </span>
            ) : null}
            {group.overlapCount > 0 ? (
              <span className="rounded-full border border-rose-900/70 bg-rose-950/40 px-2.5 py-1 text-rose-200">
                doppelt in anderen Batches ({group.overlapCount})
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {group.parentProductId ? (
              <Link
                href={`/parents/${group.parentProductId}`}
                className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-800"
              >
                Parent öffnen
              </Link>
            ) : null}
            {repAmazonUrl ? (
              <a
                href={repAmazonUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-800"
              >
                Amazon öffnen
              </a>
            ) : null}
            <Link
              href={`/imports/${batchId}/mapping-lab/brand?brand=${encodeURIComponent(norm(group.brand) || "__ohne_marke__")}&section=${section}`}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-800"
            >
              Marke fokussieren
            </Link>
          </div>

          {group.overlapLabels.length > 0 ? (
            <div className="mt-2 text-xs text-rose-200">
              {group.overlapLabels.slice(0, 4).join(" · ")}
            </div>
          ) : null}

          <details className="mt-3 rounded-xl border border-neutral-800 bg-neutral-900/60">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm text-neutral-200 marker:hidden">
              Zugehörige Childs anzeigen ({group.children.length})
            </summary>
            <div className="border-t border-neutral-800 p-3">
              <div className="space-y-3">
                {group.children.map((child) => {
                  const childAmazonUrl = amazonUrl(child.asin, null);
                  return (
                    <div key={child.asin} className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
                      <div className="grid gap-3 md:grid-cols-[56px_minmax(0,1fr)]">
                        <div className="h-14 w-14 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
                          {child.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={child.imageUrl} alt={child.title ?? child.asin} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-neutral-500">–</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">{child.title ?? "Ohne Titel"}</div>
                              <div className="mt-1 text-xs text-neutral-400">{child.asin}</div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-neutral-400">
                              <span>{euro(child.parentRevenue)}</span>
                              <span>{intFmt(child.reviewsCount)} Reviews</span>
                              <span>{dec(child.rating)} Rating</span>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {childAmazonUrl ? (
                              <a
                                href={childAmazonUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-800"
                              >
                                Amazon öffnen
                              </a>
                            ) : null}
                          </div>
                          {section === "details" ? (
                            <div className="mt-2 grid gap-2 text-xs text-neutral-400 sm:grid-cols-2 xl:grid-cols-4">
                              <div>Leaf: {child.leafString ?? "–"}</div>
                              <div>Preis: {euro(child.price)}</div>
                              <div>ASIN Umsatz: {euro(child.asinRevenue)}</div>
                              <div>ASIN Sales: {intFmt(child.asinSales)}</div>
                              <div>Parent Sales: {intFmt(child.parentSales)}</div>
                              <div>BSR: {intFmt(child.bsr)}</div>
                              <div>Subcat BSR: {intFmt(child.subcatBsr)}</div>
                              <div>
                                Codes: {[child.ean, child.gtin, child.upc, child.isbn].filter(Boolean).join(" / ") || "–"}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
