import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_PER_PAGE = 100;
const MAX_PER_PAGE = 200;
const AUTO_GROUP_LIMIT = 50;
const CANDIDATE_GROUP_LIMIT = 100;

type Props = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{
    q?: string;
    brand?: string;
    leaf?: string;
    bucket?: "all" | "auto" | "candidate" | "rest";
    onlyUnmapped?: string;
    overlap?: "all" | "with-overlap" | "no-overlap";
    page?: string;
    perPage?: string;
    view?: "groups" | "rows";
  }>;
};

type RowLite = {
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

type DecoratedRow = RowLite & {
  mappedParentId: string | null;
  mappedMethod: string | null;
  representativeAsin: string | null;
  parentRepresentativeAsin: string | null;
  parentRepresentativeUrl: string | null;
  overlapCategory2Names: string[];
  overlapCount: number;
  bucket: "auto" | "candidate" | "rest";
  primarySignal: string;
  signalBadges: string[];
  normalizedTitle: string;
};

type GroupInfo = {
  key: string;
  label: string;
  rows: DecoratedRow[];
};

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
    .replace(/\s+/g, " ")
    .trim();
}

const TITLE_STOPWORDS = new Set([
  "der", "die", "das", "und", "mit", "fuer", "fur", "set", "pack", "stueck", "stuck", "farbe",
  "inkl", "inklusive", "von", "im", "am", "an", "aus", "ein", "eine", "kg", "g", "ml", "l",
]);

function titleTokens(title: string | null | undefined) {
  const s = norm(title);
  if (!s) return [] as string[];
  return s.split(" ").filter((t) => t.length >= 3 && !TITLE_STOPWORDS.has(t));
}

function titleFingerprint(title: string | null | undefined) {
  return [...new Set(titleTokens(title))].sort().slice(0, 8).join("|");
}

function formatEuro(v?: number | null) {
  if (typeof v !== "number") return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);
}
function formatInt(v?: number | null) {
  if (typeof v !== "number") return "–";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(v);
}
function formatFloat(v?: number | null, digits = 2) {
  if (typeof v !== "number") return "–";
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
}

function amazonUrl(asin: string) {
  return `https://www.amazon.de/dp/${asin}`;
}

function codeValues(r: RowLite) {
  return [r.ean, r.gtin, r.upc, r.isbn].filter(Boolean) as string[];
}
function ratingKey(v: number | null) {
  if (typeof v !== "number") return "na";
  return v.toFixed(2);
}
function parentKey(r: RowLite) {
  if (typeof r.parentRevenue !== "number" || typeof r.parentSales !== "number") return null;
  return `${r.parentRevenue.toFixed(2)}|${r.parentSales}`;
}

function addToMap(map: Map<string, DecoratedRow[]>, key: string | null, row: DecoratedRow) {
  if (!key) return;
  const arr = map.get(key) ?? [];
  arr.push(row);
  map.set(key, arr);
}

function buildGroups(rows: DecoratedRow[]) {
  const codeGroups = new Map<string, DecoratedRow[]>();
  const imageGroups = new Map<string, DecoratedRow[]>();
  const exactParentGroups = new Map<string, DecoratedRow[]>();
  const reviewRatingLeafGroups = new Map<string, DecoratedRow[]>();
  const nearFamilyGroups = new Map<string, DecoratedRow[]>();

  for (const row of rows) {
    const b = row.brandNorm || "__unknown_brand__";

    for (const code of codeValues(row)) addToMap(codeGroups, `${b}|code:${code}`, row);
    if (row.imageUrl) addToMap(imageGroups, `${b}|img:${row.imageUrl}`, row);
    const pk = parentKey(row);
    if (pk) addToMap(exactParentGroups, `${b}|prs:${pk}`, row);

    if (row.brandNorm && row.leafString && typeof row.reviewsCount === "number" && typeof row.rating === "number") {
      addToMap(reviewRatingLeafGroups, `${row.brandNorm}|${norm(row.leafString)}|rev:${row.reviewsCount}|rat:${ratingKey(row.rating)}`, row);
    }

    if (
      row.brandNorm &&
      row.leafString &&
      typeof row.reviewsCount === "number" &&
      typeof row.rating === "number" &&
      typeof row.parentRevenue === "number" &&
      typeof row.parentSales === "number"
    ) {
      const revBand = Math.round(row.parentRevenue / 1000);
      const salesBand = Math.round(row.parentSales / 25);
      const titleFp = titleFingerprint(row.title).split("|").slice(0, 3).join("|");
      addToMap(
        nearFamilyGroups,
        `${row.brandNorm}|${norm(row.leafString)}|rev:${row.reviewsCount}|rat:${ratingKey(row.rating)}|pr:${revBand}|ps:${salesBand}|tf:${titleFp}`,
        row,
      );
    }
  }

  const autoGroups: GroupInfo[] = [];
  const candidateGroups: GroupInfo[] = [];
  const rowToAuto = new Map<string, GroupInfo>();
  const rowToCandidate = new Map<string, GroupInfo>();

  function pushGroups(source: Map<string, DecoratedRow[]>, labelPrefix: string, target: GroupInfo[], assign: Map<string, GroupInfo>) {
    for (const [key, value] of source.entries()) {
      const unique = [...new Map(value.map((r) => [r.asin, r])).values()];
      if (unique.length < 2) continue;
      const group: GroupInfo = {
        key,
        label: `${labelPrefix} · ${unique.length} Childs`,
        rows: unique.sort((a, b) => (b.asinRevenue ?? 0) - (a.asinRevenue ?? 0)),
      };
      target.push(group);
      for (const row of unique) if (!assign.has(row.asin)) assign.set(row.asin, group);
    }
  }

  pushGroups(codeGroups, "Auto: gleicher Code + Marke", autoGroups, rowToAuto);
  pushGroups(imageGroups, "Auto: gleiches Bild + Marke", autoGroups, rowToAuto);
  pushGroups(exactParentGroups, "Auto: exakter Parent-Umsatz/-Sales + Marke", autoGroups, rowToAuto);
  pushGroups(reviewRatingLeafGroups, "Kandidat: gleiche Reviews + gleiches Rating + Marke + Leaf", candidateGroups, rowToCandidate);
  pushGroups(nearFamilyGroups, "Kandidat: gleiche Reviews/Rating + Marke + Leaf + nahe Parent-Werte", candidateGroups, rowToCandidate);

  const decorated = rows.map((row) => {
    const auto = rowToAuto.get(row.asin);
    const cand = rowToCandidate.get(row.asin);
    const signalBadges: string[] = [];
    if (codeValues(row).length) signalBadges.push("Code vorhanden");
    if (row.imageUrl) signalBadges.push("Bild vorhanden");
    if (typeof row.reviewsCount === "number" && typeof row.rating === "number") signalBadges.push("Reviews + Rating vorhanden");
    if (typeof row.parentRevenue === "number" && typeof row.parentSales === "number") signalBadges.push("Parent-Werte vorhanden");
    if (row.overlapCount > 0) signalBadges.push(`ASIN in ${row.overlapCount} anderer Kategorie2`);

    let bucket: DecoratedRow["bucket"] = "rest";
    let primarySignal = "Rest / noch kein starker Cluster";
    if (auto) {
      bucket = "auto";
      primarySignal = auto.label;
    } else if (cand) {
      bucket = "candidate";
      primarySignal = cand.label;
    }

    return { ...row, bucket, primarySignal, signalBadges, normalizedTitle: norm(row.title) };
  });

  return {
    rows: decorated,
    autoGroups: autoGroups.sort((a, b) => b.rows.length - a.rows.length).slice(0, AUTO_GROUP_LIMIT),
    candidateGroups: candidateGroups.sort((a, b) => b.rows.length - a.rows.length).slice(0, CANDIDATE_GROUP_LIMIT),
  };
}

function filterRows(
  rows: DecoratedRow[],
  q: string,
  brand: string,
  leaf: string,
  bucket: "all" | "auto" | "candidate" | "rest",
  onlyUnmapped: boolean,
  overlap: "all" | "with-overlap" | "no-overlap",
) {
  const qn = norm(q);
  return rows.filter((row) => {
    if (brand !== "all" && (row.brandNorm ?? "__unknown_brand__") !== brand) return false;
    if (leaf !== "all" && norm(row.leafString) !== leaf) return false;
    if (bucket !== "all" && row.bucket !== bucket) return false;
    if (onlyUnmapped && row.mappedParentId) return false;
    if (overlap === "with-overlap" && row.overlapCount === 0) return false;
    if (overlap === "no-overlap" && row.overlapCount > 0) return false;
    if (!qn) return true;
    const hay = [row.asin, row.title ?? "", row.brand ?? "", row.leafString ?? "", row.parentRepresentativeAsin ?? "", ...codeValues(row)].join(" ").toLowerCase();
    return hay.includes(qn);
  });
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #262626", borderRadius: 16, background: "#111", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h2>
        {subtitle ? <div style={{ color: "#9a9a9a", fontSize: 12 }}>{subtitle}</div> : null}
      </div>
      <div style={{ marginTop: 14 }}>{children}</div>
    </section>
  );
}

function LabelValue({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 10, background: "#151515", minWidth: 0 }}>
      <div style={{ color: "#8f8f8f", fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ color: accent ?? "#f5f5f5", fontWeight: 700, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "yellow" | "red" }) {
  const colors = {
    neutral: { bg: "#1a1a1a", border: "#313131", color: "#d8d8d8" },
    green: { bg: "#0f1912", border: "#274531", color: "#9be2ad" },
    yellow: { bg: "#19170e", border: "#4a4220", color: "#ead58a" },
    red: { bg: "#1b1010", border: "#4b2222", color: "#ef9a9a" },
  }[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.color, padding: "5px 10px", fontSize: 12, fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function ProductRowCard({ row }: { row: DecoratedRow }) {
  const img = row.imageUrl || "/vercel.svg";
  const bucketTone = row.bucket === "auto" ? "green" : row.bucket === "candidate" ? "yellow" : "neutral";
  const parentHref = row.mappedParentId ? `/parents/${row.mappedParentId}` : null;

  return (
    <div style={{ border: "1px solid #262626", borderRadius: 14, background: "#0f0f0f", padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "88px minmax(0,1.35fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
        <div>
          <img src={img} alt={row.title ?? row.asin} style={{ width: 88, height: 88, objectFit: "contain", borderRadius: 12, border: "1px solid #2a2a2a", background: "#fff" }} />
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <Badge tone={bucketTone}>{row.bucket.toUpperCase()}</Badge>
            {row.overlapCount > 0 ? <Badge tone="red">Overlap: {row.overlapCount}</Badge> : null}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <a href={amazonUrl(row.asin)} target="_blank" style={{ color: "#fff", fontWeight: 800, textDecoration: "underline" }}>{row.asin}</a>
            {parentHref ? <Link href={parentHref} style={{ color: "#b9d4ff", textDecoration: "underline", fontSize: 13 }}>Parent öffnen</Link> : null}
          </div>
          <div style={{ marginTop: 6, fontWeight: 700, lineHeight: 1.35, fontSize: 15, color: "#f1f1f1" }}>{row.title ?? "(kein Titel)"}</div>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Badge>{row.brand ?? "keine Marke"}</Badge>
            <Badge>{row.leafString ?? "kein Leaf"}</Badge>
            {row.mappedMethod ? <Badge>{row.mappedMethod}</Badge> : null}
            {row.parentRepresentativeAsin ? <Badge>Rep: {row.parentRepresentativeAsin}</Badge> : null}
          </div>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
            <LabelValue label="ASIN-Umsatz" value={formatEuro(row.asinRevenue)} />
            <LabelValue label="Parent-Umsatz" value={formatEuro(row.parentRevenue)} />
            <LabelValue label="ASIN-Sales" value={formatInt(row.asinSales)} />
            <LabelValue label="Parent-Sales" value={formatInt(row.parentSales)} />
            <LabelValue label="Preis" value={formatEuro(row.price)} />
            <LabelValue label="Reviews" value={formatInt(row.reviewsCount)} />
            <LabelValue label="Rating" value={formatFloat(row.rating)} />
            <LabelValue label="BSR" value={formatInt(row.bsr)} />
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#9a9a9a", fontSize: 12, marginBottom: 8 }}>Primäres Signal</div>
          <div style={{ fontWeight: 700, lineHeight: 1.4 }}>{row.primarySignal}</div>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {row.signalBadges.map((badge) => <Badge key={badge}>{badge}</Badge>)}
          </div>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
            <LabelValue label="EAN" value={row.ean ?? "–"} />
            <LabelValue label="GTIN" value={row.gtin ?? "–"} />
            <LabelValue label="UPC" value={row.upc ?? "–"} />
            <LabelValue label="ISBN" value={row.isbn ?? "–"} />
          </div>
          {row.overlapCount > 0 ? (
            <div style={{ marginTop: 10, border: "1px solid #412121", background: "#180f0f", borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 12, color: "#d6adad", fontWeight: 800 }}>Gleiche ASIN in anderer Kategorie2</div>
              <div style={{ marginTop: 4, color: "#f0c6c6", fontSize: 13 }}>{row.overlapCategory2Names.join(" · ")}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GroupList({ groups, emptyText }: { groups: GroupInfo[]; emptyText: string }) {
  if (groups.length === 0) return <div style={{ color: "#a0a0a0" }}>{emptyText}</div>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {groups.map((group) => (
        <details key={group.key} style={{ border: "1px solid #272727", borderRadius: 14, background: "#0f0f0f", padding: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 800, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span>{group.label}</span>
            <span style={{ color: "#9e9e9e", fontSize: 12 }}>{group.rows[0]?.brand ?? "ohne Marke"} · {group.rows[0]?.leafString ?? "ohne Leaf"}</span>
          </summary>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {group.rows.slice(0, 40).map((row) => <ProductRowCard key={`${group.key}:${row.asin}`} row={row} />)}
            {group.rows.length > 40 ? <div style={{ color: "#8f8f8f" }}>Weitere {group.rows.length - 40} Childs in dieser Gruppe sind in dieser ersten Version ausgeblendet.</div> : null}
          </div>
        </details>
      ))}
    </div>
  );
}

function setParam(sp: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(sp.toString());
  next.set(key, value);
  if (key !== "page") next.set("page", "1");
  return `?${next.toString()}`;
}

export default async function MappingLabPage({ params, searchParams }: Props) {
  const { batchId } = await params;
  const sp = await searchParams;

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { category2: { include: { mainCategory: true } }, files: true },
  });

  if (!batch) return <main style={{ padding: 24, fontFamily: "system-ui" }}>Batch nicht gefunden.</main>;

  const q = typeof sp.q === "string" ? sp.q : "";
  const brand = typeof sp.brand === "string" ? sp.brand : "all";
  const leaf = typeof sp.leaf === "string" ? sp.leaf : "all";
  const bucket = (["all", "auto", "candidate", "rest"].includes(sp.bucket ?? "") ? sp.bucket : "all") as "all" | "auto" | "candidate" | "rest";
  const onlyUnmapped = sp.onlyUnmapped === "1";
  const overlap = (["all", "with-overlap", "no-overlap"].includes(sp.overlap ?? "") ? sp.overlap : "all") as "all" | "with-overlap" | "no-overlap";
  const view = (["groups", "rows"].includes(sp.view ?? "") ? sp.view : "groups") as "groups" | "rows";
  const page = Math.max(1, Number(sp.page || "1") || 1);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(20, Number(sp.perPage || DEFAULT_PER_PAGE) || DEFAULT_PER_PAGE));
  const urlSp = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));

  const rowsRaw = await prisma.productRow.findMany({
    where: { batchId },
    orderBy: [{ asinRevenue: "desc" }, { parentRevenue: "desc" }, { asin: "asc" }],
    select: {
      asin: true, title: true, brand: true, brandNorm: true, imageUrl: true, leafString: true,
      price: true, parentRevenue: true, parentSales: true, asinRevenue: true, asinSales: true,
      reviewsCount: true, rating: true, bsr: true, subcatBsr: true, ean: true, gtin: true, upc: true, isbn: true,
    },
  });

  const mappings = batch.month
    ? await prisma.childToParentMap.findMany({
        where: { month: batch.month, category2Id: batch.category2Id, childAsin: { in: rowsRaw.map((r) => r.asin) } },
        select: { childAsin: true, parentProductId: true, representativeAsin: true, method: true },
      })
    : [];

  const parentIds = [...new Set(mappings.map((m) => m.parentProductId))];
  const parents = parentIds.length
    ? await prisma.parentProduct.findMany({ where: { id: { in: parentIds } }, select: { id: true, representativeAsin: true, representativeUrl: true } })
    : [];

  const parentById = new Map(parents.map((p) => [p.id, p]));
  const mappingByAsin = new Map(mappings.map((m) => [m.childAsin, m]));

  const rowsDecoratedBase: DecoratedRow[] = rowsRaw.map((row) => {
    const mapping = mappingByAsin.get(row.asin);
    const parent = mapping?.parentProductId ? parentById.get(mapping.parentProductId) : null;
    return {
      ...row,
      mappedParentId: mapping?.parentProductId ?? null,
      mappedMethod: mapping?.method ?? null,
      representativeAsin: mapping?.representativeAsin ?? null,
      parentRepresentativeAsin: parent?.representativeAsin ?? null,
      parentRepresentativeUrl: parent?.representativeUrl ?? null,
      overlapCategory2Names: [],
      overlapCount: 0,
      bucket: "rest",
      primarySignal: "",
      signalBadges: [],
      normalizedTitle: "",
    };
  });

  const { rows, autoGroups, candidateGroups } = buildGroups(rowsDecoratedBase);

  // Overlap-Prüfung nur für gefilterte + sichtbare Rows, damit die Seite nicht mit dutzenden Zusatzqueries explodiert.
  const brands = [...new Set(rows.map((r) => r.brandNorm ?? "__unknown_brand__"))].sort();
  const leaves = [...new Set(rows.map((r) => norm(r.leafString)).filter(Boolean))].sort();
  const preFilteredRows = filterRows(rows, q, brand, leaf, bucket, onlyUnmapped, "all");

  const pageRowsBase = preFilteredRows.slice((page - 1) * perPage, page * perPage);
  const pageAsins = [...new Set(pageRowsBase.map((r) => r.asin))];
  const overlapMap = new Map<string, Set<string>>();
  if (batch.month && pageAsins.length > 0) {
    const overlapRows = await prisma.productRow.findMany({
      where: {
        month: batch.month,
        asin: { in: pageAsins },
        category2Id: { not: batch.category2Id },
        category2: { mainCategoryId: batch.category2.mainCategoryId },
      },
      select: { asin: true, category2: { select: { name: true } } },
    });
    for (const ov of overlapRows) {
      const set = overlapMap.get(ov.asin) ?? new Set<string>();
      set.add(ov.category2.name);
      overlapMap.set(ov.asin, set);
    }
  }

  const rowsWithOverlap = rows.map((row) => {
    const overlapNames = [...(overlapMap.get(row.asin) ?? new Set<string>())].sort();
    const signalBadges = row.signalBadges.filter((b) => !b.startsWith("ASIN in "));
    if (overlapNames.length > 0) signalBadges.push(`ASIN in ${overlapNames.length} anderer Kategorie2`);
    return { ...row, overlapCategory2Names: overlapNames, overlapCount: overlapNames.length, signalBadges };
  });

  const filteredRows = filterRows(rowsWithOverlap, q, brand, leaf, bucket, onlyUnmapped, overlap);
  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
  const clampedPage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((clampedPage - 1) * perPage, clampedPage * perPage);

  const visibleAsinSet = new Set(visibleRows.map((r) => r.asin));
  const filteredAutoGroups = autoGroups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => visibleAsinSet.has(r.asin)) }))
    .filter((g) => g.rows.length >= 2);
  const filteredCandidateGroups = candidateGroups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => visibleAsinSet.has(r.asin)) }))
    .filter((g) => g.rows.length >= 2 && !filteredAutoGroups.some((ag) => ag.rows.some((ar) => g.rows.some((gr) => gr.asin === ar.asin))));

  const summary = {
    total: rows.length,
    mapped: rows.filter((r) => !!r.mappedParentId).length,
    unmapped: rows.filter((r) => !r.mappedParentId).length,
    auto: rows.filter((r) => r.bucket === "auto").length,
    candidate: rows.filter((r) => r.bucket === "candidate").length,
    rest: rows.filter((r) => r.bucket === "rest").length,
  };

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0b", color: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link href={`/imports/${batchId}`} style={{ color: "#bdbdbd", textDecoration: "underline" }}>← zurück zum Batch</Link>
            <Link
              href={`/imports/${batchId}/mapping-lab/brand`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid #2f2f2f",
                background: "#151515",
                color: "#f5f5f5",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Marken-Ansicht öffnen →
            </Link>
          </div>
          <h1 style={{ margin: "12px 0 6px", fontSize: 28, fontWeight: 900 }}>Mapping Lab</h1>
          <div style={{ color: "#c0c0c0" }}>{batch.category2.mainCategory.name} → {batch.category2.name} · Monat {batch.month ?? "–"}</div>
          <div style={{ color: "#8f8f8f", marginTop: 6 }}>
            Diese Seite zeigt <b>Child-Produkte</b> des Batches. Für große Batches lädt sie absichtlich nur die aktuelle Seite der Rohansicht und prüft Overlaps nur für die sichtbaren Produkte.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          <Badge tone="green">Auto = sehr sichere Vorgruppen</Badge>
          <Badge tone="yellow">Kandidat = gute Muster, noch prüfen</Badge>
          <Badge tone="neutral">Rest = keine starke Familie</Badge>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 10 }}>
        <LabelValue label="Childs im Batch" value={formatInt(summary.total)} />
        <LabelValue label="bereits gemappt" value={formatInt(summary.mapped)} accent="#9be2ad" />
        <LabelValue label="ohne ParentMap" value={formatInt(summary.unmapped)} accent="#efc58f" />
        <LabelValue label="Auto-Bucket" value={formatInt(summary.auto)} accent="#9be2ad" />
        <LabelValue label="Kandidaten-Bucket" value={formatInt(summary.candidate)} accent="#ead58a" />
        <LabelValue label="Rest-Bucket" value={formatInt(summary.rest)} />
      </div>

      <SectionCard title="Filter & Sicht" subtitle="Für große Batches ist standardmäßig die Gruppenansicht sinnvoll. Die Rohsicht ist paginiert.">
        <form method="GET" style={{ display: "grid", gridTemplateColumns: "2fr repeat(6,minmax(0,1fr)) auto", gap: 10, alignItems: "end" }}>
          <div>
            <div style={{ color: "#8f8f8f", fontSize: 12, marginBottom: 6 }}>Suche</div>
            <input name="q" defaultValue={q} placeholder="ASIN, Titel, Brand, Leaf, Code…" style={{ width: "100%", background: "#0b0b0b", color: "#fff", border: "1px solid #303030", borderRadius: 10, padding: "10px 12px" }} />
          </div>
          <div>
            <div style={{ color: "#8f8f8f", fontSize: 12, marginBottom: 6 }}>Marke</div>
            <select name="brand" defaultValue={brand} style={{ width: "100%", background: "#0b0b0b", color: "#fff", border: "1px solid #303030", borderRadius: 10, padding: "10px 12px" }}>
              <option value="all">alle</option>
              {brands.map((b) => <option key={b} value={b}>{b === "__unknown_brand__" ? "ohne Marke" : b}</option>)}
            </select>
          </div>
          <div>
            <div style={{ color: "#8f8f8f", fontSize: 12, marginBottom: 6 }}>Leaf</div>
            <select name="leaf" defaultValue={leaf} style={{ width: "100%", background: "#0b0b0b", color: "#fff", border: "1px solid #303030", borderRadius: 10, padding: "10px 12px" }}>
              <option value="all">alle</option>
              {leaves.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <div style={{ color: "#8f8f8f", fontSize: 12, marginBottom: 6 }}>Bucket</div>
            <select name="bucket" defaultValue={bucket} style={{ width: "100%", background: "#0b0b0b", color: "#fff", border: "1px solid #303030", borderRadius: 10, padding: "10px 12px" }}>
              <option value="all">alle</option>
              <option value="auto">auto</option>
              <option value="candidate">kandidat</option>
              <option value="rest">rest</option>
            </select>
          </div>
          <div>
            <div style={{ color: "#8f8f8f", fontSize: 12, marginBottom: 6 }}>Overlap</div>
            <select name="overlap" defaultValue={overlap} style={{ width: "100%", background: "#0b0b0b", color: "#fff", border: "1px solid #303030", borderRadius: 10, padding: "10px 12px" }}>
              <option value="all">alle</option>
              <option value="with-overlap">nur mit Overlap</option>
              <option value="no-overlap">nur ohne Overlap</option>
            </select>
          </div>
          <div>
            <div style={{ color: "#8f8f8f", fontSize: 12, marginBottom: 6 }}>Ansicht</div>
            <select name="view" defaultValue={view} style={{ width: "100%", background: "#0b0b0b", color: "#fff", border: "1px solid #303030", borderRadius: 10, padding: "10px 12px" }}>
              <option value="groups">Gruppen zuerst</option>
              <option value="rows">Rohsicht</option>
            </select>
          </div>
          <div>
            <div style={{ color: "#8f8f8f", fontSize: 12, marginBottom: 6 }}>pro Seite</div>
            <select name="perPage" defaultValue={String(perPage)} style={{ width: "100%", background: "#0b0b0b", color: "#fff", border: "1px solid #303030", borderRadius: 10, padding: "10px 12px" }}>
              {[50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid #303030", borderRadius: 10, padding: "10px 12px", background: "#0b0b0b" }}>
            <input type="checkbox" name="onlyUnmapped" value="1" defaultChecked={onlyUnmapped} />
            <span>nur ohne ParentMap</span>
          </label>
          <button type="submit" style={{ borderRadius: 10, border: "1px solid #2f2f2f", background: "#fff", color: "#000", padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>Anwenden</button>
        </form>
      </SectionCard>

      <div style={{ marginTop: 18, display: "grid", gap: 18 }}>
        <SectionCard title="1) Sehr sichere Vorgruppen (Auto)" subtitle="Begrenzt auf die größten Gruppen. Diese Sektion sollte jetzt schnell laden.">
          <GroupList groups={filteredAutoGroups} emptyText="Keine Auto-Gruppen im aktuellen Filter gefunden." />
        </SectionCard>

        <SectionCard title="2) Starke Kandidaten-Familien" subtitle="Begrenzt auf die größten Kandidatengruppen. Für sehr große Batches ist das der wichtigste Arbeitsmodus.">
          <GroupList groups={filteredCandidateGroups} emptyText="Keine Kandidaten-Familien im aktuellen Filter gefunden." />
        </SectionCard>

        <SectionCard title="3) Rohsicht / Rest" subtitle={`Zeigt nur die aktuelle Seite: ${formatInt(visibleRows.length)} von ${formatInt(totalFiltered)} gefilterten Childs.`}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ color: "#9a9a9a", fontSize: 13 }}>Seite {clampedPage} / {totalPages}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {clampedPage > 1 ? <Link href={setParam(urlSp, "page", String(clampedPage - 1))} style={{ color: "#fff", textDecoration: "underline" }}>← vorherige</Link> : null}
              {clampedPage < totalPages ? <Link href={setParam(urlSp, "page", String(clampedPage + 1))} style={{ color: "#fff", textDecoration: "underline" }}>nächste →</Link> : null}
            </div>
          </div>
          {view === "rows" ? (
            <div style={{ display: "grid", gap: 10 }}>
              {visibleRows.length === 0 ? <div style={{ color: "#a0a0a0" }}>Keine Produkte im aktuellen Filter.</div> : visibleRows.map((row) => <ProductRowCard key={row.asin} row={row} />)}
            </div>
          ) : (
            <div style={{ color: "#a0a0a0" }}>Die Rohsicht ist absichtlich nicht standardmäßig offen. Stell oben "Ansicht" auf "Rohsicht", wenn du einzelne Childs durchgehen willst.</div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
