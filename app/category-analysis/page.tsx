import type { CSSProperties, ReactNode } from "react";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CategoryScopeTreeFilter, { type ScopeTreeNode } from "./CategoryScopeTreeFilter";

type SearchParams = {
  month?: string | string[];
  include?: string | string[];
  exclude?: string | string[];
  mainCategoryId?: string | string[];
  newExitLimit?: string | string[];
  newExitRevenueBand?: string | string[];
  newExitFlagsOnly?: string | string[];
  moversPreset?: string | string[];
  moversLimit?: string | string[];
  moversRevenueBand?: string | string[];
  hideDuplicateProducts?: string | string[];
};

type Props = {
  searchParams?: Promise<SearchParams>;
};

type ScopeToken = {
  key: string;
  scopeLevel: 1 | 2 | 3;
  scopeId: string;
  label: string;
};

type MonthPoint = {
  month: string;
  revenue: number | null;
  sales: number | null;
  priceMedian: number | null;
};

type PieSlice = {
  label: string;
  value: number;
};

type BrandCurrentRow = {
  label: string;
  revenue: number;
  share: number;
  previousRevenue: number | null;
  delta: number | null;
  parentProductsCount: number;
};

type ProductChildRow = {
  asin: string;
  title: string | null;
  imageUrl: string | null;
  asinRevenue: number | null;
  price: number | null;
  reviewsCount: number | null;
  rating: number | null;
};

type DuplicateInfo = {
  duplicateGroupId: string;
  duplicateParentCount: number;
  duplicateCategory2Count: number;
  duplicateSharedChildCount: number;
  duplicateChildAsinExamples: string[];
  keptParentProductId: string;
  keptRepresentativeAsin: string | null;
  reason: string;
};

type DuplicateMappingLite = {
  month: string;
  category2Id: string;
  parentProductId: string;
  childAsin: string;
};

type DuplicateScanResult = {
  hiddenRowKeys: Set<string>;
  duplicateMetaByMonthParentId: Map<string, DuplicateInfo>;
  duplicateRevenueByMonth: Map<string, number>;
  duplicateParentCountByMonth: Map<string, number>;
  duplicateGroupCountByMonth: Map<string, number>;
};

type ProductDisplayRow = {
  parentProductId: string;
  representativeAsin: string;
  representativeUrl: string | null;
  title: string;
  imageUrl: string | null;
  brand: string;
  revenue: number;
  share: number;
  previousRevenue: number | null;
  revenueDelta: number | null;
  sales: number | null;
  previousSales: number | null;
  salesDelta: number | null;
  priceMedian: number | null;
  previousPriceMedian: number | null;
  priceDelta: number | null;
  reviewsCount: number | null;
  previousReviewsCount: number | null;
  reviewsDelta: number | null;
  rating: number | null;
  previousRating: number | null;
  ratingDelta: number | null;
  bsrMedian: number | null;
  previousBsrMedian: number | null;
  bsrDeltaAbs: number | null;
  revenueHistory: (number | null)[];
  salesHistory: (number | null)[];
  priceHistory: (number | null)[];
  childCount: number;
  childVariants: ProductChildRow[];
  duplicateInfo?: DuplicateInfo | null;
};

type ParentMonthRow = {
  month: string;
  category2Id: string;
  order3NodeId: string | null;
  leafNodeId: string | null;
  parentRevenue: number | null;
  parentSales: number | null;
  priceMedian: number | null;
  bsrMedian: number | null;
  brandNorm: string | null;
  parentProductId: string;
  representativeAsin: string;
  representativeUrl: string | null;
  reviewsCountMedian: number | null;
  ratingMedian: number | null;
  childAsinCount: number;
  parentTitle: string | null;
};

function one(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

function csv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatMonth(month: string | null) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return "-";
  const [y, m] = month.split("-");
  return `${m}.${y}`;
}

function monthLabelShort(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [y, m] = month.split("-");
  return `${m}/${y.slice(2)}`;
}

type RevenueBand = "all" | "0-10" | "10-20" | "20-50";
type MoversPreset = "impact" | "momentum" | "losers";
type MoversRevenueBand = "all" | "0-10" | "10-20" | "20-50" | "50-plus";

function matchesRevenueBand(value: number, band: RevenueBand) {
  if (band === "all") return true;
  if (band === "0-10") return value >= 0 && value < 10_000;
  if (band === "10-20") return value >= 10_000 && value < 20_000;
  if (band === "20-50") return value >= 20_000 && value < 50_000;
  return true;
}

function hasAnyOverlap(values: Set<string>, universe: Set<string>) {
  for (const value of values) {
    if (universe.has(value)) return true;
  }
  return false;
}

function matchesMoverRevenueBand(value: number, band: MoversRevenueBand) {
  if (band === "all") return true;
  if (band === "0-10") return value >= 0 && value < 10_000;
  if (band === "10-20") return value >= 10_000 && value < 20_000;
  if (band === "20-50") return value >= 20_000 && value < 50_000;
  if (band === "50-plus") return value >= 50_000;
  return true;
}

function eur(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function num(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("de-DE").format(value);
}

function compactNumber(value: number | null | undefined, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(value / 1_000_000)}M`;
  }
  if (abs >= 1_000) {
    return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(value / 1_000)}k`;
  }
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);
}

function compactCurrency(value: number | null | undefined) {
  const base = compactNumber(value, 1);
  return base === "-" ? base : `${base} EUR`;
}

function pctFromFraction(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("de-DE", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function pctDelta(current: number | null, previous: number | null) {
  if (typeof current !== "number" || typeof previous !== "number" || previous === 0) return null;
  return (current - previous) / previous;
}

function shareFraction(value: number | null | undefined, total: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || typeof total !== "number" || !Number.isFinite(total) || total <= 0) return null;
  return value / total;
}

function topSlicesWithRest(items: { label: string; value: number }[], topN: number) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, topN);
  const restValue = sorted.slice(topN).reduce((acc, item) => acc + item.value, 0);
  return restValue > 0 ? [...top, { label: "Rest", value: restValue }] : top;
}

function normalizeLabel(value: string | null | undefined, fallback: string) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function formatDeltaText(current: number | null, previous: number | null, mode: "currency" | "number" | "percent") {
  if (typeof current !== "number" || typeof previous !== "number") return "vs. Vormonat: -";
  const deltaAbs = current - previous;
  const deltaPct = previous !== 0 ? deltaAbs / previous : null;

  let absLabel = "-";
  if (mode === "currency") absLabel = eur(deltaAbs);
  if (mode === "number") absLabel = num(deltaAbs);
  if (mode === "percent") absLabel = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(deltaAbs);

  const pctLabel = deltaPct == null ? "-" : pctFromFraction(deltaPct);
  return `vs. Vormonat: ${absLabel} · ${pctLabel}`;
}

function trendColor(delta: number | null, inverseBetter = false) {
  if (delta == null) return "#9ca3af";
  const positive = inverseBetter ? delta < 0 : delta > 0;
  if (positive) return "#22c55e";
  if (delta === 0) return "#9ca3af";
  return "#ef4444";
}

function cardStyle(): CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(13,13,13,0.98) 0%, rgba(7,7,7,0.96) 100%)",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 22px 48px rgba(0,0,0,0.32)",
    backdropFilter: "blur(10px)",
  };
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function sum(values: (number | null | undefined)[]) {
  let total = 0;
  let has = false;
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
      has = true;
    }
  }
  return has ? total : null;
}

function buildDuplicateParentMeta(rows: ParentMonthRow[], mappings: DuplicateMappingLite[]): DuplicateScanResult {
  const rowsByMonth = new Map<string, ParentMonthRow[]>();
  for (const row of rows) {
    const bucket = rowsByMonth.get(row.month) ?? [];
    bucket.push(row);
    rowsByMonth.set(row.month, bucket);
  }

  const mappingsByMonth = new Map<string, DuplicateMappingLite[]>();
  for (const mapping of mappings) {
    const bucket = mappingsByMonth.get(mapping.month) ?? [];
    bucket.push(mapping);
    mappingsByMonth.set(mapping.month, bucket);
  }

  const hiddenRowKeys = new Set<string>();
  const duplicateMetaByMonthParentId = new Map<string, DuplicateInfo>();
  const duplicateRevenueByMonth = new Map<string, number>();
  const duplicateParentCountByMonth = new Map<string, number>();
  const duplicateGroupCountByMonth = new Map<string, number>();

  for (const [month, monthRows] of rowsByMonth.entries()) {
    const rowByParentId = new Map(monthRows.map((row) => [row.parentProductId, row] as const));
    const childAsinsByParentId = new Map<string, Set<string>>();
    const asinToParentIds = new Map<string, Set<string>>();

    for (const mapping of mappingsByMonth.get(month) ?? []) {
      if (!rowByParentId.has(mapping.parentProductId)) continue;

      const childBucket = childAsinsByParentId.get(mapping.parentProductId) ?? new Set<string>();
      childBucket.add(mapping.childAsin);
      childAsinsByParentId.set(mapping.parentProductId, childBucket);

      const parentBucket = asinToParentIds.get(mapping.childAsin) ?? new Set<string>();
      parentBucket.add(mapping.parentProductId);
      asinToParentIds.set(mapping.childAsin, parentBucket);
    }

    const adjacency = new Map<string, Set<string>>();
    const duplicateChildAsinsByParentId = new Map<string, Set<string>>();

    function addEdge(a: string, b: string) {
      const ab = adjacency.get(a) ?? new Set<string>();
      ab.add(b);
      adjacency.set(a, ab);

      const ba = adjacency.get(b) ?? new Set<string>();
      ba.add(a);
      adjacency.set(b, ba);
    }

    for (const [asin, parentSet] of asinToParentIds.entries()) {
      const parentIds = [...parentSet];
      if (parentIds.length < 2) continue;

      const category2Count = new Set(
        parentIds
          .map((parentId) => rowByParentId.get(parentId)?.category2Id ?? null)
          .filter((value): value is string => !!value),
      ).size;

      if (category2Count < 2) continue;

      for (const parentId of parentIds) {
        const childBucket = duplicateChildAsinsByParentId.get(parentId) ?? new Set<string>();
        childBucket.add(asin);
        duplicateChildAsinsByParentId.set(parentId, childBucket);
      }

      for (let i = 0; i < parentIds.length; i += 1) {
        for (let j = i + 1; j < parentIds.length; j += 1) {
          addEdge(parentIds[i], parentIds[j]);
        }
      }
    }

    const visited = new Set<string>();
    let duplicateRevenue = 0;
    let duplicateParentCount = 0;
    let duplicateGroupCount = 0;

    for (const parentId of adjacency.keys()) {
      if (visited.has(parentId)) continue;

      const stack = [parentId];
      const component: string[] = [];
      visited.add(parentId);

      while (stack.length > 0) {
        const current = stack.pop()!;
        component.push(current);

        for (const next of adjacency.get(current) ?? []) {
          if (visited.has(next)) continue;
          visited.add(next);
          stack.push(next);
        }
      }

      if (component.length < 2) continue;

      const category2Count = new Set(
        component
          .map((id) => rowByParentId.get(id)?.category2Id ?? null)
          .filter((value): value is string => !!value),
      ).size;

      if (category2Count < 2) continue;

      duplicateGroupCount += 1;

      const sorted = [...component].sort((a, b) => {
        const rowA = rowByParentId.get(a);
        const rowB = rowByParentId.get(b);

        const revenueA = rowA?.parentRevenue ?? 0;
        const revenueB = rowB?.parentRevenue ?? 0;
        if (revenueB !== revenueA) return revenueB - revenueA;

        const childCountA = childAsinsByParentId.get(a)?.size ?? rowA?.childAsinCount ?? 0;
        const childCountB = childAsinsByParentId.get(b)?.size ?? rowB?.childAsinCount ?? 0;
        if (childCountB !== childCountA) return childCountB - childCountA;

        return a.localeCompare(b);
      });

      const keptParentProductId = sorted[0];
      const keptRow = rowByParentId.get(keptParentProductId) ?? null;
      const duplicateGroupId = month + "-dup-" + duplicateGroupCount;

      for (const id of sorted.slice(1)) {
        const row = rowByParentId.get(id);
        if (!row) continue;

        const duplicateChildAsins = [...(duplicateChildAsinsByParentId.get(id) ?? new Set<string>())];
        const key = month + ":" + id;

        hiddenRowKeys.add(key);
        duplicateMetaByMonthParentId.set(key, {
          duplicateGroupId,
          duplicateParentCount: component.length,
          duplicateCategory2Count: category2Count,
          duplicateSharedChildCount: duplicateChildAsins.length,
          duplicateChildAsinExamples: duplicateChildAsins.slice(0, 6),
          keptParentProductId,
          keptRepresentativeAsin: keptRow?.representativeAsin ?? null,
          reason: "Gleiche Child-ASIN in mehreren Kategorie-2-Batches im selben Monat.",
        });

        duplicateRevenue += row.parentRevenue ?? 0;
        duplicateParentCount += 1;
      }
    }

    duplicateRevenueByMonth.set(month, duplicateRevenue);
    duplicateParentCountByMonth.set(month, duplicateParentCount);
    duplicateGroupCountByMonth.set(month, duplicateGroupCount);
  }

  return { hiddenRowKeys, duplicateMetaByMonthParentId, duplicateRevenueByMonth, duplicateParentCountByMonth, duplicateGroupCountByMonth };
}

function rowDedupKey(row: Pick<ParentMonthRow, "month" | "parentProductId">) {
  return row.month + ":" + row.parentProductId;
}

function DuplicateMarker({ info }: { info?: DuplicateInfo | null }) {
  if (!info) return null;

  const title = [
    info.reason,
    "Referenz bleibt: " + (info.keptRepresentativeAsin ?? info.keptParentProductId),
    "Gleiche Childs: " + (info.duplicateChildAsinExamples.join(", ") || "-"),
  ].join(" | ");

  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        border: "1px solid rgba(245,158,11,0.45)",
        background: "rgba(245,158,11,0.14)",
        color: "#fcd34d",
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      Doppelt
      <span style={{ color: "#fbbf24", fontWeight: 800 }}>
        {num(info.duplicateSharedChildCount)} Childs
      </span>
    </span>
  );
}

function buildTreeIndex(roots: ScopeTreeNode[]) {
  const nodeByKey = new Map<string, ScopeTreeNode>();
  const parentByKey = new Map<string, string | null>();
  const descendantsByKey = new Map<string, string[]>();
  const subtreeByKey = new Map<string, string[]>();

  const walk = (node: ScopeTreeNode, parentKey: string | null) => {
    nodeByKey.set(node.key, node);
    parentByKey.set(node.key, parentKey);

    const descendants: string[] = [];
    const subtree: string[] = [node.key];

    for (const child of node.children) {
      walk(child, node.key);
      descendants.push(child.key, ...(descendantsByKey.get(child.key) ?? []));
      subtree.push(...(subtreeByKey.get(child.key) ?? []));
    }

    descendantsByKey.set(node.key, Array.from(new Set(descendants)));
    subtreeByKey.set(node.key, Array.from(new Set(subtree)));
  };

  for (const root of roots) walk(root, null);

  const getAncestors = (key: string) => {
    const ancestors: string[] = [];
    let cursor = parentByKey.get(key) ?? null;
    while (cursor) {
      ancestors.push(cursor);
      cursor = parentByKey.get(cursor) ?? null;
    }
    return ancestors;
  };

  return { nodeByKey, parentByKey, descendantsByKey, subtreeByKey, getAncestors };
}

function buildSelectionHelpers(roots: ScopeTreeNode[], includeKeys: string[], excludeKeys: string[]) {
  const index = buildTreeIndex(roots);

  const isSelected = (key: string) => {
    const included = includeKeys.includes(key) || index.getAncestors(key).some((ancestor) => includeKeys.includes(ancestor));
    const excluded = excludeKeys.includes(key) || index.getAncestors(key).some((ancestor) => excludeKeys.includes(ancestor));
    return included && !excluded;
  };

  const getSelectionState = (node: ScopeTreeNode): "checked" | "partial" | "unchecked" => {
    const subtree = index.subtreeByKey.get(node.key) ?? [node.key];
    const selectedCount = subtree.filter((key) => isSelected(key)).length;
    if (selectedCount === 0) return "unchecked";
    if (selectedCount === subtree.length) return "checked";
    return "partial";
  };

  const collectEffectiveTokens = (node: ScopeTreeNode, out: ScopeToken[]) => {
    const state = getSelectionState(node);
    if (state === "unchecked") return;
    if (state === "checked" || node.children.length === 0) {
      out.push({ key: node.key, scopeLevel: node.scopeLevel, scopeId: node.scopeId, label: node.label });
      return;
    }
    for (const child of node.children) collectEffectiveTokens(child, out);
  };

  const effectiveTokens: ScopeToken[] = [];
  for (const root of roots) collectEffectiveTokens(root, effectiveTokens);

  return { index, effectiveTokens };
}

function buildTokenWhere(tokens: ScopeToken[]) {
  return tokens.map((token) => {
    if (token.scopeLevel === 1) {
      return { category2: { mainCategoryId: token.scopeId } };
    }
    if (token.scopeLevel === 2) {
      return { category2Id: token.scopeId };
    }
    return { order3NodeId: token.scopeId };
  });
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return ["M", start.x, start.y, "A", r, r, 0, largeArcFlag, 0, end.x, end.y, "L", cx, cy, "Z"].join(" ");
}

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}

function seriesPath(values: (number | null)[], width: number, height: number, padding = 14) {
  const numeric = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (numeric.length === 0) return "";

  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const normalizeY = (value: number) => {
    if (max === min) return padding + innerH / 2;
    const ratio = (value - min) / (max - min);
    return height - padding - ratio * innerH;
  };

  const step = values.length <= 1 ? 0 : innerW / (values.length - 1);

  let path = "";
  let segmentOpen = false;

  values.forEach((value, index) => {
    const x = padding + index * step;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      segmentOpen = false;
      return;
    }
    const y = normalizeY(value);
    if (!segmentOpen) {
      path += `M ${x} ${y}`;
      segmentOpen = true;
    } else {
      path += ` L ${x} ${y}`;
    }
  });

  return path.trim();
}

function formatPointValue(value: number | null, mode: "currency" | "number") {
  if (mode === "currency") return compactCurrency(value);
  return compactNumber(value, 1);
}

function normalizePointMeta(values: (number | null)[], width: number, height: number, padding = 18) {
  const numeric = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (numeric.length === 0) return { min: 0, max: 0, step: 0, innerH: height - padding * 2 };
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const innerH = height - padding * 2;
  const step = values.length <= 1 ? 0 : (width - padding * 2) / (values.length - 1);
  return { min, max, step, innerH };
}

function pointY(value: number, min: number, max: number, height: number, padding = 18) {
  if (max === min) return height / 2;
  return height - padding - ((value - min) / (max - min)) * (height - padding * 2);
}

function kpiValue(rows: ParentMonthRow[]) {
  const revenue = sum(rows.map((row) => row.parentRevenue));
  const sales = sum(rows.map((row) => row.parentSales));
  const prices = rows
    .map((row) => row.priceMedian)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const brands = new Set(rows.map((row) => row.brandNorm ?? "__no_brand__")).size;
  const parents = new Set(rows.map((row) => row.parentProductId)).size;
  return {
    revenue,
    sales,
    priceMedian: median(prices),
    brandsCount: brands,
    parentProductsCount: parents,
  };
}

function buildPieSlices(options: {
  effectiveTokens: ScopeToken[];
  treeIndex: ReturnType<typeof buildTreeIndex>;
  currentMonthRows: Array<{
    category2Id: string;
    order3NodeId: string | null;
    leafNodeId: string | null;
    parentRevenue: number | null;
  }>;
  nodeById: Map<string, { id: string; parentId: string | null; name: string }>;
}) {
  const { effectiveTokens, treeIndex, currentMonthRows, nodeById } = options;
  const slices = new Map<string, number>();

  function addSlice(label: string, value: number | null | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return;
    slices.set(label, (slices.get(label) ?? 0) + value);
  }

  function immediateChildUnder(ancestorId: string, descendantId: string | null) {
    if (!descendantId || descendantId === ancestorId) return null;
    let current = nodeById.get(descendantId) ?? null;
    while (current) {
      if (current.parentId === ancestorId) return current;
      if (!current.parentId) return null;
      current = nodeById.get(current.parentId) ?? null;
    }
    return null;
  }

  for (const token of effectiveTokens) {
    const treeNode = treeIndex.nodeByKey.get(token.key);

    if (token.scopeLevel === 1 || token.scopeLevel === 2) {
      const children = treeNode?.children ?? [];
      for (const child of children) {
        addSlice(child.label, child.revenueSum);
      }
      continue;
    }

    const relevantRows = currentMonthRows.filter((row) => row.order3NodeId === token.scopeId);
    for (const row of relevantRows) {
      const child = immediateChildUnder(token.scopeId, row.leafNodeId);
      if (child) {
        addSlice(child.name, row.parentRevenue);
      }
    }
  }

  return [...slices.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

export default async function CategoryAnalysisPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};

  const requestedMonth = one(sp.month);
  const requestedMainCategoryId = one(sp.mainCategoryId);
  const explicitInclude = csv(one(sp.include));
  const explicitExclude = csv(one(sp.exclude));
  const requestedNewExitLimit = one(sp.newExitLimit);
  const requestedNewExitRevenueBand = one(sp.newExitRevenueBand);
  const requestedNewExitFlagsOnly = one(sp.newExitFlagsOnly);
  const requestedMoversPreset = one(sp.moversPreset);
  const requestedMoversLimit = one(sp.moversLimit);
  const requestedMoversRevenueBand = one(sp.moversRevenueBand);
  const requestedHideDuplicateProducts = one(sp.hideDuplicateProducts);
  const newExitLimit: number | null = requestedNewExitLimit === "all" ? null : ["20", "50", "100"].includes(requestedNewExitLimit ?? "") ? Number(requestedNewExitLimit) : 20;
  const newExitRevenueBand: RevenueBand = (["all", "0-10", "10-20", "20-50"].includes(requestedNewExitRevenueBand ?? "")
    ? requestedNewExitRevenueBand
    : "all") as RevenueBand;
  const newExitFlagsOnly = requestedNewExitFlagsOnly === "1";
  const moversPreset: MoversPreset = (["impact", "momentum", "losers"].includes(requestedMoversPreset ?? "") ? requestedMoversPreset : "impact") as MoversPreset;
  const moversLimit: number | null = requestedMoversLimit === "all" ? null : ["20", "50", "100"].includes(requestedMoversLimit ?? "") ? Number(requestedMoversLimit) : 20;
  const moversRevenueBand: MoversRevenueBand = (["all", "0-10", "10-20", "20-50", "50-plus"].includes(requestedMoversRevenueBand ?? "")
    ? requestedMoversRevenueBand
    : "all") as MoversRevenueBand;
  const hideDuplicateProducts = requestedHideDuplicateProducts !== "0";

  const allAvailableMonths = await prisma.aggCategoryNodeMonth.findMany({
    where: { scopeLevel: 1 },
    distinct: ["month"],
    orderBy: { month: "desc" },
    select: { month: true },
  });

  const monthValues = allAvailableMonths.map((row) => row.month);
  const selectedMonth = requestedMonth && monthValues.includes(requestedMonth) ? requestedMonth : monthValues[0] ?? null;

  if (!selectedMonth) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0b", color: "#f5f5f5", minHeight: "100vh" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Kategorie Analyse</h1>
        <div style={{ ...cardStyle(), marginTop: 16, color: "#d1d5db" }}>Es gibt noch keine Rollups fuer die Kategorie-Analyse.</div>
      </main>
    );
  }

  const [level1Rows, level2Rows, level3Rows, currentMonthParentScopeRows, categoryNodes] = await Promise.all([
    prisma.aggCategoryNodeMonth.findMany({
      where: { month: selectedMonth, scopeLevel: 1 },
      orderBy: [{ revenueSum: "desc" }, { nodeName: "asc" }],
      select: { scopeId: true, nodeName: true, revenueSum: true, salesSum: true, parentProductsCount: true },
    }),
    prisma.aggCategoryNodeMonth.findMany({
      where: { month: selectedMonth, scopeLevel: 2 },
      orderBy: [{ revenueSum: "desc" }, { nodeName: "asc" }],
      select: {
        mainCategoryId: true,
        scopeId: true,
        nodeName: true,
        revenueSum: true,
        salesSum: true,
        parentProductsCount: true,
      },
    }),
    prisma.aggCategoryNodeMonth.findMany({
      where: { month: selectedMonth, scopeLevel: 3 },
      orderBy: [{ revenueSum: "desc" }, { nodeName: "asc" }],
      select: {
        mainCategoryId: true,
        category2Id: true,
        scopeId: true,
        nodeName: true,
        revenueSum: true,
        salesSum: true,
        parentProductsCount: true,
      },
    }),
    prisma.aggParentProductMonth.findMany({
      where: { month: selectedMonth, isUnmapped: false },
      select: {
        category2Id: true,
        order3NodeId: true,
        leafNodeId: true,
        parentRevenue: true,
        category2: { select: { mainCategoryId: true } },
      },
    }),
    prisma.categoryNode.findMany({
      select: { id: true, category2Id: true, parentId: true, name: true },
    }),
  ]);

  const mainIds = level1Rows.map((row) => row.scopeId);
  const mainCategories = mainIds.length
    ? await prisma.mainCategory.findMany({ where: { id: { in: mainIds } }, select: { id: true, name: true, slug: true } })
    : [];
  const mainById = new Map<string, { id: string; name: string; slug: string }>(mainCategories.map((row) => [row.id, row]));

  const minRevenueByMain = new Map<string, number>();
  const minRevenueByCategory2 = new Map<string, number>();
  const minRevenueByOrder3 = new Map<string, number>();

  for (const row of currentMonthParentScopeRows) {
    if (typeof row.parentRevenue !== "number" || !Number.isFinite(row.parentRevenue)) continue;
    const mainCategoryId = row.category2.mainCategoryId;
    const currentMain = minRevenueByMain.get(mainCategoryId);
    if (currentMain == null || row.parentRevenue < currentMain) minRevenueByMain.set(mainCategoryId, row.parentRevenue);

    const currentCategory2 = minRevenueByCategory2.get(row.category2Id);
    if (currentCategory2 == null || row.parentRevenue < currentCategory2) minRevenueByCategory2.set(row.category2Id, row.parentRevenue);

    if (row.order3NodeId) {
      const currentOrder3 = minRevenueByOrder3.get(row.order3NodeId);
      if (currentOrder3 == null || row.parentRevenue < currentOrder3) minRevenueByOrder3.set(row.order3NodeId, row.parentRevenue);
    }
  }

  const nodeById = new Map<string, { id: string; category2Id: string; parentId: string | null; name: string }>(categoryNodes.map((node) => [node.id, node]));

  const level3ByCategory2 = new Map<string, typeof level3Rows>();
  for (const row of level3Rows) {
    const key = row.category2Id ?? "";
    if (!key) continue;
    const bucket = level3ByCategory2.get(key) ?? [];
    bucket.push(row);
    level3ByCategory2.set(key, bucket);
  }

  const roots: ScopeTreeNode[] = level1Rows
    .map((mainRow) => ({
      key: `1:${mainRow.scopeId}`,
      label: mainRow.nodeName ?? mainById.get(mainRow.scopeId)?.name ?? "Unbenannte Hauptkategorie",
      scopeLevel: 1 as const,
      scopeId: mainRow.scopeId,
      revenueSum: mainRow.revenueSum,
      salesSum: mainRow.salesSum,
      parentProductsCount: mainRow.parentProductsCount,
      minProductRevenue: minRevenueByMain.get(mainRow.scopeId) ?? null,
      children: level2Rows
        .filter((row) => row.mainCategoryId === mainRow.scopeId)
        .map((level2Row) => ({
          key: `2:${level2Row.scopeId}`,
          label: level2Row.nodeName ?? "Unbenannte Unterkategorie",
          scopeLevel: 2 as const,
          scopeId: level2Row.scopeId,
          revenueSum: level2Row.revenueSum,
          salesSum: level2Row.salesSum,
          parentProductsCount: level2Row.parentProductsCount,
          minProductRevenue: minRevenueByCategory2.get(level2Row.scopeId) ?? null,
          children: (level3ByCategory2.get(level2Row.scopeId) ?? []).map((level3Row) => ({
            key: `3:${level3Row.scopeId}`,
            label: level3Row.nodeName ?? "Unbenannter Knoten",
            scopeLevel: 3 as const,
            scopeId: level3Row.scopeId,
            revenueSum: level3Row.revenueSum,
            salesSum: level3Row.salesSum,
            parentProductsCount: level3Row.parentProductsCount,
            minProductRevenue: minRevenueByOrder3.get(level3Row.scopeId) ?? null,
            children: [],
          })),
        })),
    }))
    .filter((root) => root.children.length > 0 || root.parentProductsCount > 0);

  if (roots.length === 0) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0b", color: "#f5f5f5", minHeight: "100vh" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Kategorie Analyse</h1>
        <div style={{ ...cardStyle(), marginTop: 16, color: "#d1d5db" }}>
          Im Monat {selectedMonth} gibt es aktuell keine Kategorien mit gebundenen Produkten.
        </div>
      </main>
    );
  }

  const defaultRootKey = requestedMainCategoryId ? `1:${requestedMainCategoryId}` : roots[0]?.key ?? null;
  const includeKeys = explicitInclude.length > 0 ? explicitInclude : defaultRootKey ? [defaultRootKey] : [];
  const excludeKeys = explicitExclude;

  const helpers = buildSelectionHelpers(roots, includeKeys, excludeKeys);
  const effectiveTokens = helpers.effectiveTokens;

  const selectedMonthIndex = monthValues.indexOf(selectedMonth);
  const historyMonths = selectedMonthIndex >= 0 ? monthValues.slice(selectedMonthIndex).reverse() : [...monthValues].reverse();
  const previousMonth = historyMonths.length >= 2 ? historyMonths[historyMonths.length - 2] : null;

  const tokenWhere = buildTokenWhere(effectiveTokens);

  const rawParentRows = tokenWhere.length
    ? await prisma.aggParentProductMonth.findMany({
        where: {
          isUnmapped: false,
          month: { in: historyMonths },
          OR: tokenWhere,
        },
        select: {
          month: true,
          category2Id: true,
          order3NodeId: true,
          leafNodeId: true,
          parentRevenue: true,
          parentSales: true,
          priceMedian: true,
          bsrMedian: true,
          brandNorm: true,
          parentProductId: true,
          representativeAsin: true,
          representativeUrl: true,
          reviewsCountMedian: true,
          ratingMedian: true,
          childAsinCount: true,
          parentProduct: { select: { titleNorm: true } },
        },
      })
    : [];

  const parentRows: ParentMonthRow[] = rawParentRows.map((row) => ({
    month: row.month,
    category2Id: row.category2Id,
    order3NodeId: row.order3NodeId,
    leafNodeId: row.leafNodeId,
    parentRevenue: row.parentRevenue,
    parentSales: row.parentSales,
    priceMedian: row.priceMedian,
    bsrMedian: row.bsrMedian,
    brandNorm: row.brandNorm,
    parentProductId: row.parentProductId,
    representativeAsin: row.representativeAsin,
    representativeUrl: row.representativeUrl,
    reviewsCountMedian: row.reviewsCountMedian,
    ratingMedian: row.ratingMedian,
    childAsinCount: row.childAsinCount,
    parentTitle: row.parentProduct?.titleNorm ?? null,
  }));
  const duplicateCandidateParentIds = Array.from(new Set(parentRows.map((row) => row.parentProductId)));
  const duplicateCandidateMappings = duplicateCandidateParentIds.length && historyMonths.length
    ? await prisma.childToParentMap.findMany({
        where: {
          month: { in: historyMonths },
          parentProductId: { in: duplicateCandidateParentIds },
        },
        select: {
          month: true,
          category2Id: true,
          parentProductId: true,
          childAsin: true,
        },
      })
    : [];

  const duplicateScan = buildDuplicateParentMeta(parentRows, duplicateCandidateMappings);
  const duplicateMetaByMonthParentId = duplicateScan.duplicateMetaByMonthParentId;
  const duplicateRevenueCurrent = duplicateScan.duplicateRevenueByMonth.get(selectedMonth) ?? 0;
  const duplicateParentCountCurrent = duplicateScan.duplicateParentCountByMonth.get(selectedMonth) ?? 0;
  const duplicateGroupCountCurrent = duplicateScan.duplicateGroupCountByMonth.get(selectedMonth) ?? 0;
  const displayParentRows = hideDuplicateProducts
    ? parentRows.filter((row) => !duplicateScan.hiddenRowKeys.has(rowDedupKey(row)))
    : parentRows;


  const rowsByMonth = new Map<string, ParentMonthRow[]>();
  for (const row of displayParentRows) {
    const bucket = rowsByMonth.get(row.month) ?? [];
    bucket.push(row);
    rowsByMonth.set(row.month, bucket);
  }

  const currentRows = rowsByMonth.get(selectedMonth) ?? [];
  const previousRows = previousMonth ? rowsByMonth.get(previousMonth) ?? [] : [];

  const currentKpi = kpiValue(currentRows);
  const previousKpi = kpiValue(previousRows);

  const history: MonthPoint[] = historyMonths.map((month) => {
    const rows = rowsByMonth.get(month) ?? [];
    const value = kpiValue(rows);
    return {
      month,
      revenue: value.revenue,
      sales: value.sales,
      priceMedian: value.priceMedian,
    };
  });

  const currentRevenueTotal = currentKpi.revenue ?? 0;
  const previousRevenueTotal = previousKpi.revenue ?? 0;

  const brandCurrentMap = new Map<string, { revenue: number; parents: number }>();
  for (const row of currentRows) {
    const label = normalizeLabel(row.brandNorm, "Ohne Marke");
    const bucket = brandCurrentMap.get(label) ?? { revenue: 0, parents: 0 };
    bucket.revenue += row.parentRevenue ?? 0;
    bucket.parents += 1;
    brandCurrentMap.set(label, bucket);
  }

  const brandPreviousMap = new Map<string, number>();
  for (const row of previousRows) {
    const label = normalizeLabel(row.brandNorm, "Ohne Marke");
    brandPreviousMap.set(label, (brandPreviousMap.get(label) ?? 0) + (row.parentRevenue ?? 0));
  }

  const brandRowsAll: BrandCurrentRow[] = [...brandCurrentMap.entries()]
    .map(([label, value]) => ({
      label,
      revenue: value.revenue,
      share: shareFraction(value.revenue, currentRevenueTotal) ?? 0,
      previousRevenue: brandPreviousMap.get(label) ?? null,
      delta: pctDelta(value.revenue, brandPreviousMap.get(label) ?? null),
      parentProductsCount: value.parents,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const topBrandRows = brandRowsAll.slice(0, 10);
  const topBrandRevenue = topBrandRows.reduce((acc, row) => acc + row.revenue, 0);
  const topBrandPreviousRevenue = topBrandRows.reduce((acc, row) => acc + (row.previousRevenue ?? 0), 0);
  const brandTableRows =
    brandRowsAll.length > 10
      ? [
          ...topBrandRows,
          {
            label: "Rest",
            revenue: Math.max(0, currentRevenueTotal - topBrandRevenue),
            share: shareFraction(Math.max(0, currentRevenueTotal - topBrandRevenue), currentRevenueTotal) ?? 0,
            previousRevenue: previousRevenueTotal > 0 ? Math.max(0, previousRevenueTotal - topBrandPreviousRevenue) : null,
            delta: pctDelta(
              Math.max(0, currentRevenueTotal - topBrandRevenue),
              previousRevenueTotal > 0 ? Math.max(0, previousRevenueTotal - topBrandPreviousRevenue) : null,
            ),
            parentProductsCount: Math.max(0, currentRows.length - topBrandRows.reduce((acc, row) => acc + row.parentProductsCount, 0)),
          },
        ]
      : topBrandRows;

  const brandPieSlices = topSlicesWithRest(
    brandRowsAll.map((row) => ({ label: row.label, value: row.revenue })),
    10,
  );

  const productHistoryMap = new Map<string, Map<string, ParentMonthRow>>();
  for (const row of displayParentRows) {
    const monthMap = productHistoryMap.get(row.parentProductId) ?? new Map<string, ParentMonthRow>();
    monthMap.set(row.month, row);
    productHistoryMap.set(row.parentProductId, monthMap);
  }

  const currentParentRowsSorted = [...currentRows].sort((a, b) => (b.parentRevenue ?? 0) - (a.parentRevenue ?? 0));
  const topProductBaseRows = currentParentRowsSorted.slice(0, 150);
  const topParentIds = topProductBaseRows.map((row) => row.parentProductId);
  const detailMonths = Array.from(new Set([selectedMonth, previousMonth].filter(Boolean) as string[]));
  const detailParentIdsAll = Array.from(new Set([...currentRows.map((row) => row.parentProductId), ...previousRows.map((row) => row.parentProductId)]));

  const detailMappings = topParentIds.length
    ? await prisma.childToParentMap.findMany({
        where: {
          month: selectedMonth,
          parentProductId: { in: topParentIds },
        },
        select: {
          month: true,
          parentProductId: true,
          category2Id: true,
          childAsin: true,
        },
      })
    : [];

  const detailRows = detailMappings.length
    ? await prisma.productRow.findMany({
        where: {
          month: selectedMonth,
          asin: { in: Array.from(new Set(detailMappings.map((row) => row.childAsin))) },
        },
        select: {
          month: true,
          asin: true,
          category2Id: true,
          title: true,
          imageUrl: true,
          asinRevenue: true,
          price: true,
          reviewsCount: true,
          rating: true,
        },
      })
    : [];

  const detailMappingsAll = detailParentIdsAll.length && detailMonths.length
    ? await prisma.childToParentMap.findMany({
        where: {
          month: { in: detailMonths },
          parentProductId: { in: detailParentIdsAll },
        },
        select: {
          month: true,
          parentProductId: true,
          category2Id: true,
          childAsin: true,
        },
      })
    : [];

  const detailRowsAll = detailMappingsAll.length
    ? await prisma.productRow.findMany({
        where: {
          month: { in: detailMonths },
          asin: { in: Array.from(new Set(detailMappingsAll.map((row) => row.childAsin))) },
        },
        select: {
          month: true,
          asin: true,
          category2Id: true,
          title: true,
          imageUrl: true,
          asinRevenue: true,
          price: true,
          reviewsCount: true,
          rating: true,
        },
      })
    : [];

  const detailRowByKey = new Map<string, (typeof detailRows)[number]>();
  for (const row of detailRows) {
    detailRowByKey.set(`${row.month}:${row.category2Id}:${row.asin}`, row);
  }

  const detailRowByKeyAll = new Map<string, (typeof detailRowsAll)[number]>();
  for (const row of detailRowsAll) {
    detailRowByKeyAll.set(`${row.month}:${row.category2Id}:${row.asin}`, row);
  }

  const bestDetailByParentId = new Map<string, { title: string | null; imageUrl: string | null }>();
  const childRowsByParentId = new Map<string, ProductChildRow[]>();
  const currentChildAsinsByParentId = new Map<string, Set<string>>();
  const previousChildAsinsByParentId = new Map<string, Set<string>>();

  for (const mapping of detailMappingsAll) {
    const target =
      mapping.month === selectedMonth
        ? currentChildAsinsByParentId
        : mapping.month === previousMonth
          ? previousChildAsinsByParentId
          : null;

    if (!target) continue;

    const bucket = target.get(mapping.parentProductId) ?? new Set<string>();
    bucket.add(mapping.childAsin);
    target.set(mapping.parentProductId, bucket);
  }

  const currentChildUniverse = new Set<string>();
  for (const childSet of currentChildAsinsByParentId.values()) {
    for (const asin of childSet) currentChildUniverse.add(asin);
  }

  const previousChildUniverse = new Set<string>();
  for (const childSet of previousChildAsinsByParentId.values()) {
    for (const asin of childSet) previousChildUniverse.add(asin);
  }

  const bestScoreByParentId = new Map<string, number>();

  for (const mapping of detailMappingsAll) {
    const row = detailRowByKeyAll.get(`${mapping.month}:${mapping.category2Id}:${mapping.childAsin}`);
    if (!row) continue;
    const score =
      (mapping.month === selectedMonth ? 10_000_000 : 0) +
      (row.imageUrl ? 1_000_000 : 0) +
      (row.title ? 100_000 : 0) +
      (row.asinRevenue ?? 0);
    if ((bestScoreByParentId.get(mapping.parentProductId) ?? -1) < score) {
      bestScoreByParentId.set(mapping.parentProductId, score);
      bestDetailByParentId.set(mapping.parentProductId, {
        title: row.title ?? null,
        imageUrl: row.imageUrl ?? null,
      });
    }
  }

  for (const mapping of detailMappings) {
    const row = detailRowByKey.get(`${mapping.month}:${mapping.category2Id}:${mapping.childAsin}`);
    if (!row) continue;
    const bucket = childRowsByParentId.get(mapping.parentProductId) ?? [];
    bucket.push({
      asin: row.asin,
      title: row.title ?? null,
      imageUrl: row.imageUrl ?? null,
      asinRevenue: row.asinRevenue ?? null,
      price: row.price ?? null,
      reviewsCount: row.reviewsCount ?? null,
      rating: row.rating ?? null,
    });
    childRowsByParentId.set(mapping.parentProductId, bucket);
  }

  for (const [parentId, rows] of childRowsByParentId.entries()) {
    rows.sort((a, b) => (b.asinRevenue ?? 0) - (a.asinRevenue ?? 0));
    childRowsByParentId.set(parentId, rows);
  }

  const productDisplayRows: ProductDisplayRow[] = topProductBaseRows.map((row) => {
    const detail = bestDetailByParentId.get(row.parentProductId);
    const monthMap = productHistoryMap.get(row.parentProductId) ?? new Map<string, ParentMonthRow>();
    const previous = previousMonth ? monthMap.get(previousMonth) ?? null : null;
    const title = detail?.title?.trim() || row.parentTitle?.trim() || `Parent ${row.representativeAsin}`;

    return {
      parentProductId: row.parentProductId,
      representativeAsin: row.representativeAsin,
      representativeUrl: row.representativeUrl,
      title,
      imageUrl: detail?.imageUrl ?? null,
      brand: normalizeLabel(row.brandNorm, "Ohne Marke"),
      revenue: row.parentRevenue ?? 0,
      share: shareFraction(row.parentRevenue ?? 0, currentRevenueTotal) ?? 0,
      previousRevenue: previous?.parentRevenue ?? null,
      revenueDelta: pctDelta(row.parentRevenue ?? 0, previous?.parentRevenue ?? null),
      sales: row.parentSales ?? null,
      previousSales: previous?.parentSales ?? null,
      salesDelta: pctDelta(row.parentSales ?? null, previous?.parentSales ?? null),
      priceMedian: row.priceMedian ?? null,
      previousPriceMedian: previous?.priceMedian ?? null,
      priceDelta: pctDelta(row.priceMedian ?? null, previous?.priceMedian ?? null),
      reviewsCount: row.reviewsCountMedian,
      previousReviewsCount: previous?.reviewsCountMedian ?? null,
      reviewsDelta: pctDelta(row.reviewsCountMedian, previous?.reviewsCountMedian ?? null),
      rating: row.ratingMedian ?? null,
      previousRating: previous?.ratingMedian ?? null,
      ratingDelta: pctDelta(row.ratingMedian ?? null, previous?.ratingMedian ?? null),
      bsrMedian: row.bsrMedian ?? null,
      previousBsrMedian: previous?.bsrMedian ?? null,
      bsrDeltaAbs:
        typeof row.bsrMedian === "number" && typeof previous?.bsrMedian === "number"
          ? row.bsrMedian - previous.bsrMedian
          : null,
      revenueHistory: historyMonths.map((month) => monthMap.get(month)?.parentRevenue ?? null),
      salesHistory: historyMonths.map((month) => monthMap.get(month)?.parentSales ?? null),
      priceHistory: historyMonths.map((month) => monthMap.get(month)?.priceMedian ?? null),
      childCount: row.childAsinCount,
      childVariants: childRowsByParentId.get(row.parentProductId) ?? [],
      duplicateInfo: hideDuplicateProducts ? null : duplicateMetaByMonthParentId.get(rowDedupKey(row)) ?? null,
    };
  });

  const productShareRows = currentParentRowsSorted.slice(0, 10).map((row) => {
    const previous = previousRows.find((item) => item.parentProductId === row.parentProductId) ?? null;
    const detail = bestDetailByParentId.get(row.parentProductId);
    const title = detail?.title?.trim() || row.parentTitle?.trim() || `Parent ${row.representativeAsin}`;
    return {
      parentProductId: row.parentProductId,
      representativeAsin: row.representativeAsin,
      representativeUrl: row.representativeUrl,
      imageUrl: detail?.imageUrl ?? null,
      title,
      revenue: row.parentRevenue ?? 0,
      share: shareFraction(row.parentRevenue ?? 0, currentRevenueTotal) ?? 0,
      revenueDelta: pctDelta(row.parentRevenue ?? 0, previous?.parentRevenue ?? null),
    };
  });
  const productPieSlices = topSlicesWithRest(
    currentParentRowsSorted.map((row) => ({ label: row.representativeAsin, value: row.parentRevenue ?? 0 })),
    10,
  );

  const currentByParentId = new Map(currentRows.map((row) => [row.parentProductId, row] as const));
  const previousByParentId = new Map(previousRows.map((row) => [row.parentProductId, row] as const));

  const growthDrivers = Array.from(new Set([...currentByParentId.keys(), ...previousByParentId.keys()]))
    .map((parentProductId) => {
      const current = currentByParentId.get(parentProductId) ?? null;
      const previous = previousByParentId.get(parentProductId) ?? null;

      const currentRevenue = current?.parentRevenue ?? 0;
      const previousRevenue = previous?.parentRevenue ?? 0;
      const revenueDeltaAbs = currentRevenue - previousRevenue;

      const currentChilds = currentChildAsinsByParentId.get(parentProductId) ?? new Set<string>();
      const previousChilds = previousChildAsinsByParentId.get(parentProductId) ?? new Set<string>();

      const currentTouchesPrevious = hasAnyOverlap(currentChilds, previousChildUniverse);
      const previousTouchesCurrent = hasAnyOverlap(previousChilds, currentChildUniverse);

      let status: "Neu" | "Bestehend" | "Exit";
      if (current && previous) {
        status = "Bestehend";
      } else if (current && !previous) {
        status = currentTouchesPrevious ? "Bestehend" : "Neu";
      } else if (!current && previous) {
        status = previousTouchesCurrent ? "Bestehend" : "Exit";
      } else {
        status = "Bestehend";
      }

      const title =
        current?.parentTitle?.trim() ||
        previous?.parentTitle?.trim() ||
        `Parent ${current?.representativeAsin ?? previous?.representativeAsin ?? parentProductId}`;

      const detail = bestDetailByParentId.get(parentProductId);

      return {
        parentProductId,
        representativeAsin: current?.representativeAsin ?? previous?.representativeAsin ?? parentProductId,
        representativeUrl: current?.representativeUrl ?? previous?.representativeUrl ?? null,
        imageUrl: detail?.imageUrl ?? null,
        title,
        brand: normalizeLabel(current?.brandNorm ?? previous?.brandNorm, "Ohne Marke"),
        status,
        currentRevenue,
        previousRevenue,
        currentReviews: current?.reviewsCountMedian ?? null,
        previousReviews: previous?.reviewsCountMedian ?? null,
        currentSales: current?.parentSales ?? null,
        previousSales: previous?.parentSales ?? null,
        revenueDeltaAbs,
        positiveGrowth: Math.max(revenueDeltaAbs, 0),
        childCount: (childRowsByParentId.get(parentProductId) ?? []).length,
        childVariants: childRowsByParentId.get(parentProductId) ?? [],
      };
    })
    .sort((a, b) => b.revenueDeltaAbs - a.revenueDeltaAbs);

  const newGrowthRevenue = growthDrivers
    .filter((row) => row.status === "Neu")
    .reduce((acc, row) => acc + row.currentRevenue, 0);
  const existingGrowthRevenueDelta = growthDrivers
    .filter((row) => row.status === "Bestehend")
    .reduce((acc, row) => acc + row.revenueDeltaAbs, 0);
  const exitGrowthRevenue = growthDrivers
    .filter((row) => row.status === "Exit")
    .reduce((acc, row) => acc + row.previousRevenue, 0);

  const positiveGrowthRows = growthDrivers.filter((row) => row.positiveGrowth > 0);
  const positiveGrowthTotal = positiveGrowthRows.reduce((acc, row) => acc + row.positiveGrowth, 0);
  const top10PositiveGrowthValue = positiveGrowthRows.slice(0, 10).reduce((acc, row) => acc + row.positiveGrowth, 0);
  const top50PositiveGrowthValue = positiveGrowthRows.slice(0, 50).reduce((acc, row) => acc + row.positiveGrowth, 0);

  const newHighRevenueThreshold = 40000;
  const newProductsRows = growthDrivers
    .filter((row) => row.status === "Neu")
    .map((row) => ({
      ...row,
      flags: row.currentReviews != null && row.currentReviews <= 50 && row.currentRevenue >= newHighRevenueThreshold ? ["Low Reviews & High Revenue"] : [],
    }))
    .filter((row) => matchesRevenueBand(row.currentRevenue, newExitRevenueBand))
    .filter((row) => !newExitFlagsOnly || row.flags.length > 0)
    .sort((a, b) => b.currentRevenue - a.currentRevenue);
  const exitProductsRows = growthDrivers
    .filter((row) => row.status === "Exit")
    .map((row) => ({
      ...row,
      flags: row.previousRevenue > 40000 ? ["Impact"] : [],
    }))
    .filter((row) => matchesRevenueBand(row.previousRevenue, newExitRevenueBand))
    .filter((row) => !newExitFlagsOnly || row.flags.length > 0)
    .sort((a, b) => b.previousRevenue - a.previousRevenue);

  const newProductsVisible = newExitLimit == null ? newProductsRows : newProductsRows.slice(0, newExitLimit);
  const exitProductsVisible = newExitLimit == null ? exitProductsRows : exitProductsRows.slice(0, newExitLimit);

  const moversBaseRows = Array.from(currentByParentId.keys())
    .filter((parentProductId) => currentByParentId.has(parentProductId) && previousByParentId.has(parentProductId))
    .map((parentProductId) => {
      const current = currentByParentId.get(parentProductId)!;
      const previous = previousByParentId.get(parentProductId)!;
      const detail = bestDetailByParentId.get(parentProductId);
      const title = detail?.title?.trim() || current.parentTitle?.trim() || previous.parentTitle?.trim() || `Parent ${current.representativeAsin}`;
      const currentRevenue = current.parentRevenue ?? 0;
      const previousRevenue = previous.parentRevenue ?? 0;
      const currentSales = current.parentSales ?? null;
      const previousSales = previous.parentSales ?? null;
      const currentPrice = current.priceMedian ?? null;
      const previousPrice = previous.priceMedian ?? null;
      const currentBsr = current.bsrMedian ?? null;
      const previousBsr = previous.bsrMedian ?? null;
      const currentReviews = current.reviewsCountMedian ?? null;
      const previousReviews = previous.reviewsCountMedian ?? null;
      return {
        parentProductId,
        representativeAsin: current.representativeAsin,
        representativeUrl: current.representativeUrl,
        imageUrl: detail?.imageUrl ?? null,
        title,
        brand: normalizeLabel(current.brandNorm ?? previous.brandNorm, "Ohne Marke"),
        currentRevenue,
        previousRevenue,
        revenueDeltaAbs: currentRevenue - previousRevenue,
        revenueDeltaPct: previousRevenue > 0 ? (currentRevenue - previousRevenue) / previousRevenue : null,
        currentSales,
        previousSales,
        salesDeltaAbs:
          typeof currentSales === "number" && typeof previousSales === "number"
            ? currentSales - previousSales
            : null,
        currentPrice,
        previousPrice,
        priceDeltaPct: pctDelta(currentPrice, previousPrice),
        currentBsr,
        previousBsr,
        bsrDeltaAbs:
          typeof currentBsr === "number" && typeof previousBsr === "number"
            ? currentBsr - previousBsr
            : null,
        currentReviews,
        previousReviews,
        reviewsDeltaAbs:
          typeof currentReviews === "number" && typeof previousReviews === "number"
            ? currentReviews - previousReviews
            : null,
        baseRevenue: Math.max(currentRevenue, previousRevenue),
        childCount: (childRowsByParentId.get(parentProductId) ?? []).length,
        childVariants: childRowsByParentId.get(parentProductId) ?? [],
      };
    })
    .filter((row) => matchesMoverRevenueBand(row.baseRevenue, moversRevenueBand));

  const moversSorted = [...moversBaseRows].sort((a, b) => {
    if (moversPreset === "momentum") {
      const aPct = a.revenueDeltaPct ?? Number.NEGATIVE_INFINITY;
      const bPct = b.revenueDeltaPct ?? Number.NEGATIVE_INFINITY;
      if (bPct !== aPct) return bPct - aPct;
      return b.revenueDeltaAbs - a.revenueDeltaAbs;
    }
    if (moversPreset === "losers") {
      if (a.revenueDeltaAbs !== b.revenueDeltaAbs) return a.revenueDeltaAbs - b.revenueDeltaAbs;
      const aPct = a.revenueDeltaPct ?? Number.POSITIVE_INFINITY;
      const bPct = b.revenueDeltaPct ?? Number.POSITIVE_INFINITY;
      return aPct - bPct;
    }
    if (b.revenueDeltaAbs !== a.revenueDeltaAbs) return b.revenueDeltaAbs - a.revenueDeltaAbs;
    const aPct = a.revenueDeltaPct ?? Number.NEGATIVE_INFINITY;
    const bPct = b.revenueDeltaPct ?? Number.NEGATIVE_INFINITY;
    return bPct - aPct;
  });

  const moversVisible = moversLimit == null ? moversSorted : moversSorted.slice(0, moversLimit);
  const moversPositiveCount = moversBaseRows.filter((row) => row.revenueDeltaAbs > 0).length;
  const moversNegativeCount = moversBaseRows.filter((row) => row.revenueDeltaAbs < 0).length;
  const moversPresetTitle = moversPreset === "impact"
    ? "Top Wachstum EUR (Impact)"
    : moversPreset === "momentum"
      ? "Top Wachstum % (Momentum)"
      : "Top Verlierer";
  const moversPresetDescription = moversPreset === "impact"
    ? "Sortiert nach Umsatz Delta EUR zwischen M und M-1. Gut, um die groessten absoluten Gewinner zu sehen."
    : moversPreset === "momentum"
      ? "Sortiert nach Umsatz Delta %. Gut, um starke relative Spruenge auf bestehender Basis zu finden."
      : "Sortiert nach negativem Umsatz Delta EUR. Gut, um die groessten Verlierer im Bestand zu sehen.";

  const revenueDeltaAbs =
    typeof currentKpi.revenue === "number" && typeof previousKpi.revenue === "number"
      ? currentKpi.revenue - previousKpi.revenue
      : null;
  const salesDeltaAbs =
    typeof currentKpi.sales === "number" && typeof previousKpi.sales === "number"
      ? currentKpi.sales - previousKpi.sales
      : null;
  const priceDeltaAbs =
    typeof currentKpi.priceMedian === "number" && typeof previousKpi.priceMedian === "number"
      ? currentKpi.priceMedian - previousKpi.priceMedian
      : null;

  const pieSlices = buildPieSlices({
    effectiveTokens,
    treeIndex: helpers.index,
    currentMonthRows: currentRows.map((row) => ({
      category2Id: row.category2Id,
      order3NodeId: row.order3NodeId,
      leafNodeId: row.leafNodeId,
      parentRevenue: row.parentRevenue,
    })),
    nodeById,
  });
  const totalPieValue = pieSlices.reduce((acc, slice) => acc + slice.value, 0);
  const colors = ["#60a5fa", "#22c55e", "#f59e0b", "#a78bfa", "#f472b6", "#34d399", "#fb7185", "#facc15"];

  return (
    <main style={{
      position: "relative",
      padding: "12px 12px 40px",
      boxSizing: "border-box",
      fontFamily: "system-ui",
      color: "#f8fafc",
      minHeight: "100vh",
      width: "100%",
      maxWidth: "100vw",
      overflowX: "hidden",
      backgroundColor: "#050505",
    }}>
      <div style={{ pointerEvents: "none", position: "absolute", inset: 0 }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 30%)" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.08, backgroundImage: "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
      </div>

      <FloatingWorkbenchMenu
        selectedMonth={selectedMonth}
        previousMonth={previousMonth}
        effectiveTokenCount={effectiveTokens.length}
        includeCount={includeKeys.length}
        excludeCount={excludeKeys.length}
      />

      <div style={{ position: "relative", width: "100%", maxWidth: "none", margin: 0, minWidth: 0, display: "grid", gap: 16 }}>
        <section style={{ ...cardStyle(), padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(135deg, rgba(255,255,255,0.06), transparent 32%, transparent 68%, rgba(255,255,255,0.04))" }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "fit-content", borderRadius: 999, border: "1px solid rgba(125,211,252,0.22)", background: "rgba(14,165,233,0.12)", color: "#bae6fd", padding: "6px 10px", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Category Analysis
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#f8fafc" }}>Filter & Scope</div>
                  <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 14, maxWidth: 860 }}>
                    Gleiche Struktur, ruhigeres Design: links die Kategorieauswahl, rechts der kompakte Apply-Bereich. Der Kategoriebaum selbst bleibt unveraendert.
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <Link
                    href="/toolbox"
                    style={{
                      borderRadius: 12,
                      border: "1px solid #272a2f",
                      background: "#111315",
                      color: "#f3f4f6",
                      textDecoration: "none",
                      fontWeight: 800,
                      padding: "11px 14px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Zur Toolbox
                  </Link>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <SummaryBadge label="Monat" value={formatMonth(selectedMonth)} />
                    <SummaryBadge label="Vergleich" value={previousMonth ? formatMonth(previousMonth) : "n/a"} />
                    <SummaryBadge label="Scope" value={num(effectiveTokens.length)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            <CategoryScopeTreeFilter month={selectedMonth} monthOptions={monthValues} roots={roots} initialIncludeKeys={includeKeys} initialExcludeKeys={excludeKeys} hideDuplicateProducts={hideDuplicateProducts} />
          </div>
        </section>

        <SectionAccordion
          id="kpi"
          defaultOpen
          eyebrow="Was ist?"
          title="KPI"
          description="Die wichtigsten Kennzahlen fuer den aktuellen Scope. Hauptwert = aktueller Monat, darunter der Vergleich zum Vormonat."
          badges={[
            { label: "Standard offen", tone: "positive" },
            { label: `${num(currentKpi.parentProductsCount)} Parents` },
          ]}
        >
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <KpiCard title="Umsatz" value={eur(currentKpi.revenue)} subtitle={formatDeltaText(currentKpi.revenue, previousKpi.revenue, "currency")} delta={pctDelta(currentKpi.revenue, previousKpi.revenue)} />
            <KpiCard title="Verkaeufe" value={num(currentKpi.sales)} subtitle={formatDeltaText(currentKpi.sales, previousKpi.sales, "number")} delta={pctDelta(currentKpi.sales, previousKpi.sales)} />
            <KpiCard title="Median Preis" value={eur(currentKpi.priceMedian)} subtitle={formatDeltaText(currentKpi.priceMedian, previousKpi.priceMedian, "percent")} delta={pctDelta(currentKpi.priceMedian, previousKpi.priceMedian)} />
            <KpiCard title="Parent-Produkte" value={num(currentKpi.parentProductsCount)} subtitle={formatDeltaText(currentKpi.parentProductsCount, previousKpi.parentProductsCount, "number")} delta={pctDelta(currentKpi.parentProductsCount, previousKpi.parentProductsCount)} />
            <KpiCard title="Markenanzahl" value={num(currentKpi.brandsCount)} subtitle={formatDeltaText(currentKpi.brandsCount, previousKpi.brandsCount, "number")} delta={pctDelta(currentKpi.brandsCount, previousKpi.brandsCount)} />
          </div>
        </SectionAccordion>

        <SectionAccordion
          id="trends"
          eyebrow="Was ist?"
          title="Trends"
          description="Historie bis zum gewaehlten Monat. Fehlende Monate werden nicht verbunden."
          badges={[{ label: `${history.length} Monate` }]}
        >
          <div style={{ display: "grid", gap: 16, alignItems: "start", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
            <div style={{ ...cardStyle(), minWidth: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>Historie</div>
                  <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 13 }}>
                    Standardmaessig maximale Historie bis zum gewaehlten Monat.
                  </div>
                </div>
                <div style={{ color: "#9ca3af", fontSize: 13 }}>
                  Monate: {history.length > 0 ? `${monthLabelShort(history[0].month)} -> ${monthLabelShort(history[history.length - 1].month)}` : "-"}
                </div>
              </div>

              <div style={{ marginTop: 18, display: "grid", gap: 18 }}>
                <TrendCard title="Umsatz ueber Zeit" valueNow={eur(currentKpi.revenue)} values={history.map((point) => point.revenue)} labels={history.map((point) => point.month)} mode="currency" />
                <TrendCard title="Verkaeufe ueber Zeit" valueNow={num(currentKpi.sales)} values={history.map((point) => point.sales)} labels={history.map((point) => point.month)} mode="number" />
                <TrendCard title="Median Preis ueber Zeit" valueNow={eur(currentKpi.priceMedian)} values={history.map((point) => point.priceMedian)} labels={history.map((point) => point.month)} mode="currency" />
              </div>
            </div>

            <div style={{ ...cardStyle(), minWidth: 0, overflow: "hidden" }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>Anteil der naechsten Ebene</div>
              <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 13 }}>
                Die Grafik zeigt die jeweils naechste Ebene unter deiner aktuellen Auswahl.
              </div>

              <div style={{ marginTop: 18 }}>
                {pieSlices.length === 0 || totalPieValue <= 0 ? (
                  <div style={{ border: "1px dashed #2a2a2a", borderRadius: 14, padding: 16, color: "#9ca3af" }}>
                    Fuer diese Auswahl gibt es aktuell keine weitere aufrollbare Unterstruktur.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
                    <svg width="240" height="240" viewBox="0 0 240 240" role="img" aria-label="Scope-Anteile">
                      <circle cx="120" cy="120" r="80" fill="#0b0b0b" stroke="#1f2937" strokeWidth="1" />
                      {(() => {
                        let startAngle = 0;
                        return pieSlices.map((slice, index) => {
                          const sweep = (slice.value / totalPieValue) * 360;
                          const path = arcPath(120, 120, 80, startAngle, startAngle + sweep);
                          startAngle += sweep;
                          return <path key={slice.label} d={path} fill={colors[index % colors.length]} stroke="#0b0b0b" strokeWidth="2" />;
                        });
                      })()}
                      <circle cx="120" cy="120" r="42" fill="#111111" stroke="#0b0b0b" strokeWidth="2" />
                      <text x="120" y="114" textAnchor="middle" fill="#9ca3af" fontSize="12">Scope</text>
                      <text x="120" y="132" textAnchor="middle" fill="#f5f5f5" fontSize="16" fontWeight="700">{num(totalPieValue)}</text>
                    </svg>

                    <div style={{ width: "100%", display: "grid", gap: 8 }}>
                      {pieSlices.map((slice, index) => (
                        <div key={slice.label} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center" }}>
                          <span style={{ width: 12, height: 12, borderRadius: 999, background: colors[index % colors.length], display: "inline-block" }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{slice.label}</div>
                            <div style={{ color: "#9ca3af", fontSize: 12 }}>{eur(slice.value)}</div>
                          </div>
                          <div style={{ color: "#e5e7eb", fontWeight: 700 }}>{pctFromFraction(slice.value / totalPieValue)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SectionAccordion>

        <SectionAccordion
          id="current"
          eyebrow="Was ist?"
          title="Marken- & Produktanteile"
          description="Die zentrale Übersicht für die aktuelle Verteilung im Scope: links Markenanteile, rechts Produktanteile. Die Top 50 sitzen jetzt als eigenes Modul direkt darunter."
          badges={[
            { label: `${num(brandRowsAll.length)} Marken` },
            { label: "Top 10 Anteile" },
          ]}
        >
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
              alignItems: "start",
            }}
          >
            <div
              style={{
                ...cardStyle(),
                border: "1px solid rgba(96,165,250,0.26)",
                boxShadow:
                  "0 22px 44px rgba(0,0,0,0.34), 0 0 0 1px rgba(96,165,250,0.06), 0 0 28px rgba(59,130,246,0.10)",
                background:
                  "linear-gradient(180deg, rgba(15,23,42,0.26) 0%, rgba(7,7,7,0.96) 48%, rgba(7,7,7,0.98) 100%)",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  border: "1px solid rgba(125,211,252,0.22)",
                  background: "rgba(14,165,233,0.12)",
                  color: "#bae6fd",
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Marken
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "end",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>Top 10 Marken</div>
                  <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 13 }}>
                    Anteil am Umsatz im aktuellen Scope: Top 10 Marken plus Rest.
                  </div>
                </div>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>
                  {num(brandRowsAll.length)} Marken
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                  alignItems: "start",
                }}
              >
                <CompactShareDonut
                  slices={brandPieSlices}
                  total={currentRevenueTotal}
                  colors={colors}
                  centerLabel="Marken"
                />
                <ShareLegendList
                  rows={brandTableRows.map((row) => ({
                    key: row.label,
                    label: row.label,
                    sublabel: `${eur(row.revenue)} · ${num(row.parentProductsCount)} Parents`,
                    share: row.share,
                    delta: row.delta,
                  }))}
                  colors={colors}
                  showColumnLabels
                />
              </div>
            </div>

            <div
              style={{
                ...cardStyle(),
                border: "1px solid rgba(167,139,250,0.26)",
                boxShadow:
                  "0 22px 44px rgba(0,0,0,0.34), 0 0 0 1px rgba(167,139,250,0.06), 0 0 28px rgba(139,92,246,0.10)",
                background:
                  "linear-gradient(180deg, rgba(30,27,75,0.26) 0%, rgba(7,7,7,0.96) 48%, rgba(7,7,7,0.98) 100%)",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  border: "1px solid rgba(196,181,253,0.20)",
                  background: "rgba(139,92,246,0.12)",
                  color: "#ddd6fe",
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Produktanteile
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "end",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>Top 10 Produktanteile</div>
                  <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 13 }}>
                    Anteil am Umsatz im aktuellen Scope: Top 10 Parent-Produkte plus Rest.
                  </div>
                </div>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Parent-Ebene</div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                  alignItems: "start",
                }}
              >
                <CompactShareDonut
                  slices={productPieSlices}
                  total={currentRevenueTotal}
                  colors={colors}
                  centerLabel="Produkte"
                />
                <ShareLegendList
                  rows={productShareRows.map((row) => ({
                    key: row.parentProductId,
                    label: row.representativeAsin,
                    title: row.title,
                    sublabel: eur(row.revenue),
                    share: row.share,
                    delta: row.revenueDelta,
                    imageUrl: row.imageUrl,
                    href: `/parents/${row.parentProductId}`,
                    externalUrl: row.representativeUrl,
                  }))}
                  colors={colors}
                  showColumnLabels
                />
              </div>
            </div>
          </div>
        </SectionAccordion>

        <SectionAccordion
          id="top-products"
          eyebrow="Produkt-Deep-Dive"
          title="Top 150 Produkte"
          description="Eigenes Modul direkt unter den Anteilen. Hier bleibt die komplette Produktliste mit BSR, MoM-Werten und Child-Varianten zentral gebündelt."
          badges={[
            { label: `${productDisplayRows.length} Produkte` },
            { label: "Child-Varianten inklusive", tone: "positive" },
          ]}
        >
          <div
            style={{
              ...cardStyle(),
              padding: 0,
              overflow: "hidden",
              border: "1px solid rgba(96,165,250,0.28)",
              boxShadow:
                "0 22px 44px rgba(0,0,0,0.34), 0 0 0 1px rgba(96,165,250,0.06), 0 0 32px rgba(59,130,246,0.10)",
              background:
                "linear-gradient(180deg, rgba(15,23,42,0.22) 0%, rgba(7,7,7,0.96) 48%, rgba(7,7,7,0.98) 100%)",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                display: "grid",
                gap: 12,
                background:
                  "linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(56,189,248,0.10) 38%, rgba(255,255,255,0.02) 100%)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  width: "fit-content",
                  borderRadius: 999,
                  border: "1px solid rgba(125,211,252,0.22)",
                  background: "rgba(14,165,233,0.12)",
                  color: "#bae6fd",
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
              Erweiterbar auf nachfrage
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#f8fafc" }}>
                    Top 150 Produkte im Detail
                  </div>
                  <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 14 }}>
                    Komplette Produktliste mit BSR, MoM-Werten und Child-Varianten – jetzt als eigenes Modul unter den Anteilen.
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span
                    style={{
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.05)",
                      color: "#e5e7eb",
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {productDisplayRows.length} Produkte
                  </span>
                  <span
                    style={{
                      borderRadius: 999,
                      border: "1px solid rgba(34,197,94,0.18)",
                      background: "rgba(34,197,94,0.10)",
                      color: "#86efac",
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Direkt sichtbar
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 16,
                display: "grid",
                gap: 10,
                borderTop: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              {productDisplayRows.map((row) => (
                <CompactProductRow key={row.parentProductId} row={row} labels={historyMonths} />
              ))}
            </div>
          </div>
        </SectionAccordion>

        <SectionAccordion
          id="growth"
          eyebrow="Warum / Woher?"
          title="Wachstum"
          description="Wachstum wird in Beitraege zerlegt: was kommt von neuen Produkten, was aus bestehenden Parents und was ging durch Exits verloren?"
          badges={[{ label: previousMonth ? "Vergleich aktiv" : "Kein Vormonat", tone: previousMonth ? "positive" : "negative" }]}
        >
          {!previousMonth ? (
            <div style={{ ...cardStyle(), borderStyle: "dashed", color: "#d1d5db" }}>
              Fuer Wachstum braucht die Seite mindestens einen Vormonat. Im aktuellen Kontext gibt es noch keinen Vergleichsmonat.
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <GrowthDeltaCard title="Umsatz Delta" value={revenueDeltaAbs} pct={pctDelta(currentKpi.revenue, previousKpi.revenue)} mode="currency" currentValue={currentKpi.revenue} previousValue={previousKpi.revenue} />
                <GrowthDeltaCard title="Verkaeufe Delta" value={salesDeltaAbs} pct={pctDelta(currentKpi.sales, previousKpi.sales)} mode="number" currentValue={currentKpi.sales} previousValue={previousKpi.sales} />
                <GrowthDeltaCard title="Preis Delta (Median)" value={priceDeltaAbs} pct={pctDelta(currentKpi.priceMedian, previousKpi.priceMedian)} mode="currency" currentValue={currentKpi.priceMedian} previousValue={previousKpi.priceMedian} />
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
                <div style={cardStyle()}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>Umsatz-Veraenderung</div>
                      <div style={{ marginTop: 4, color: "#9ca3af", fontSize: 12 }}>
                        Netto = Neu + Veraenderung bestehender Parents - Exit-Umsatz.
                      </div>
                    </div>
                    <div style={{ color: trendColor(revenueDeltaAbs), fontSize: 18, fontWeight: 900 }}>{signedMetricValue(revenueDeltaAbs, "currency")}</div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <GrowthBreakdownBar
                      newValue={newGrowthRevenue}
                      existingValue={existingGrowthRevenueDelta}
                      exitValue={exitGrowthRevenue}
                      newCount={growthDrivers.filter((row) => row.status === "Neu").length}
                      existingCount={growthDrivers.filter((row) => row.status === "Bestehend").length}
                      exitCount={growthDrivers.filter((row) => row.status === "Exit").length}
                    />
                  </div>
                </div>

                <div style={cardStyle()}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>Verteilung des Wachstums</div>
                      <div style={{ marginTop: 4, color: "#9ca3af", fontSize: 12 }}>
                        Anteil am positiven Wachstum durch die staerksten Parent-Produkte.
                      </div>
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>{num(positiveGrowthRows.length)} positive Treiber</div>
                  </div>
                  <div style={{ marginTop: 14, display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                    <GrowthFocusCard title="Top 10 tragen" share={shareFraction(top10PositiveGrowthValue, positiveGrowthTotal)} value={top10PositiveGrowthValue} total={positiveGrowthTotal} />
                    <GrowthFocusCard title="Top 50 tragen" share={shareFraction(top50PositiveGrowthValue, positiveGrowthTotal)} value={top50PositiveGrowthValue} total={positiveGrowthTotal} />
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <GrowthDriversList rows={positiveGrowthRows.slice(0, 10).map((row) => ({
                      key: row.parentProductId,
                      asin: row.representativeAsin,
                      title: row.title,
                      brand: row.brand,
                      href: `/parents/${row.parentProductId}`,
                      externalUrl: row.representativeUrl,
                      imageUrl: row.imageUrl,
                      delta: row.positiveGrowth,
                      share: shareFraction(row.positiveGrowth, positiveGrowthTotal) ?? 0,
                    }))} />
                  </div>
                </div>
              </div>
            </>
          )}
        </SectionAccordion>

        <SectionAccordion
          id="new-exit"
          eyebrow="Warum / Woher?"
          title="Neue / Weggefallene Produkte"
          description="Neue Parents erscheinen im aktuellen Monat erstmals im Vergleich zum Vormonat, weggefallene waren vorher da und fehlen jetzt."
          badges={[
            { label: `${num(newProductsRows.length)} Neu`, tone: "positive" },
            { label: `${num(exitProductsRows.length)} Exit`, tone: "negative" },
          ]}
        >
          {!previousMonth ? (
            <div style={{ ...cardStyle(), borderStyle: "dashed", color: "#d1d5db" }}>
              Fuer neue und weggefallene Produkte braucht die Seite mindestens einen Vormonat. Im aktuellen Kontext gibt es noch keinen Vergleichsmonat.
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                <div style={{ ...cardStyle(), background: "#0f0f0f" }}>
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>Neue Parent-Produkte</div>
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12 }}>
                    <div style={{ fontSize: 42, fontWeight: 900 }}>{num(newProductsRows.length)}</div>
                    <div style={{ color: "#9ca3af", fontSize: 13 }}>{compactCurrency(newProductsRows.reduce((acc, row) => acc + row.currentRevenue, 0))} Umsatz</div>
                  </div>
                </div>
                <div style={{ ...cardStyle(), background: "#0f0f0f" }}>
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>Weggefallene Parent-Produkte</div>
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12 }}>
                    <div style={{ fontSize: 42, fontWeight: 900 }}>{num(exitProductsRows.length)}</div>
                    <div style={{ color: "#9ca3af", fontSize: 13 }}>{compactCurrency(exitProductsRows.reduce((acc, row) => acc + row.previousRevenue, 0))} Vorumsatz</div>
                  </div>
                </div>
              </div>

              <div style={{ ...cardStyle(), marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>Ansicht & Filter</div>
                    <div style={{ marginTop: 4, color: "#9ca3af", fontSize: 12 }}>
                      Auswahl pro Seite, Umsatz-Band und optional nur Produkte mit Flags.
                    </div>
                  </div>
                  <form method="get" action="/category-analysis#new-exit" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", justifyContent: "flex-end" }}>
                    {selectedMonth ? <input type="hidden" name="month" value={selectedMonth} /> : null}
                    {requestedMainCategoryId ? <input type="hidden" name="mainCategoryId" value={requestedMainCategoryId} /> : null}
                    {includeKeys.length > 0 ? <input type="hidden" name="include" value={includeKeys.join(",")} /> : null}
                    {excludeKeys.length > 0 ? <input type="hidden" name="exclude" value={excludeKeys.join(",")} /> : null}
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#cbd5e1" }}>
                      <span>Anzahl</span>
                      <select name="newExitLimit" defaultValue={newExitLimit == null ? "all" : String(newExitLimit)} style={selectInputStyle(110)}>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="all">Alle</option>
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#cbd5e1" }}>
                      <span>Umsatz-Band</span>
                      <select name="newExitRevenueBand" defaultValue={newExitRevenueBand} style={selectInputStyle(140)}>
                        <option value="all">Alle Umsaetze</option>
                        <option value="0-10">0-10k EUR</option>
                        <option value="10-20">10-20k EUR</option>
                        <option value="20-50">20-50k EUR</option>
                      </select>
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "9px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.03)", color: "#f8fafc", fontSize: 12, fontWeight: 700 }}>
                      <input type="checkbox" name="newExitFlagsOnly" value="1" defaultChecked={newExitFlagsOnly} />
                      Nur Produkte mit Flags
                    </label>
                    <button type="submit" style={primarySmallButtonStyle()}>
                      Anwenden
                    </button>
                  </form>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", alignItems: "start" }}>
                <div style={cardStyle()}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>Neu im Datensatz</div>
                      <div style={{ marginTop: 4, color: "#9ca3af", fontSize: 12 }}>
                        Flag "Low Reviews & High Revenue" = aktuell wenige Reviews, aber schon hoher Umsatz.
                      </div>
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>{num(newProductsRows.length)} Treffer</div>
                  </div>
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {newProductsVisible.length === 0 ? (
                      <div style={{ color: "#9ca3af", fontSize: 13 }}>Keine neuen Produkte fuer den aktuellen Filter.</div>
                    ) : newProductsVisible.map((row) => (
                      <NewExitProductRow key={row.parentProductId} asin={row.representativeAsin} title={row.title} brand={row.brand} imageUrl={row.imageUrl} href={`/parents/${row.parentProductId}`} externalUrl={row.representativeUrl} mainMetricLabel="Umsatz (M)" mainMetricValue={row.currentRevenue} secondaryMetricLabel="Reviews (M)" secondaryMetricValue={row.currentReviews} secondaryMode="number" flags={row.flags} childCount={row.childCount} childVariants={row.childVariants} />
                    ))}
                  </div>
                </div>

                <div style={cardStyle()}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>Weggefallen</div>
                      <div style={{ marginTop: 4, color: "#9ca3af", fontSize: 12 }}>
                        Flag "Impact" = relevantes weggefallenes Produkt mit mehr als 40.000 EUR Umsatz im Vormonat.
                      </div>
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>{num(exitProductsRows.length)} Treffer</div>
                  </div>
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {exitProductsVisible.length === 0 ? (
                      <div style={{ color: "#9ca3af", fontSize: 13 }}>Keine weggefallenen Produkte fuer den aktuellen Filter.</div>
                    ) : exitProductsVisible.map((row) => (
                      <NewExitProductRow key={row.parentProductId} asin={row.representativeAsin} title={row.title} brand={row.brand} imageUrl={row.imageUrl} href={`/parents/${row.parentProductId}`} externalUrl={row.representativeUrl} mainMetricLabel="Umsatz (M-1)" mainMetricValue={row.previousRevenue} secondaryMetricLabel="Reviews (M-1)" secondaryMetricValue={row.previousReviews} secondaryMode="number" flags={row.flags} childCount={row.childCount} childVariants={row.childVariants} />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SectionAccordion>

        <SectionAccordion
          id="movers"
          eyebrow="Warum / Woher?"
          title="Top Movers"
          description="Nur bestehende Parent-Produkte mit Daten in M und M-1. Neue und Exit-Produkte bleiben bewusst im Modul darueber."
          badges={[
            { label: `${num(moversPositiveCount)} positiv`, tone: "positive" },
            { label: `${num(moversNegativeCount)} negativ`, tone: "negative" },
          ]}
        >
          {!previousMonth ? (
            <div style={{ ...cardStyle(), borderStyle: "dashed", color: "#d1d5db" }}>
              Fuer Top Movers braucht die Seite mindestens einen Vormonat. Im aktuellen Kontext gibt es noch keinen Vergleichsmonat.
            </div>
          ) : (
            <>
              <div style={{ ...cardStyle() }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>Preset & Filter</div>
                    <div style={{ marginTop: 4, color: "#9ca3af", fontSize: 12 }}>{moversPresetTitle} · {moversPresetDescription}</div>
                  </div>
                  <form method="get" action="/category-analysis#movers" style={{ display: "grid", gap: 10, justifyItems: "end" }}>
                    {selectedMonth ? <input type="hidden" name="month" value={selectedMonth} /> : null}
                    {requestedMainCategoryId ? <input type="hidden" name="mainCategoryId" value={requestedMainCategoryId} /> : null}
                    {includeKeys.length > 0 ? <input type="hidden" name="include" value={includeKeys.join(",")} /> : null}
                    {excludeKeys.length > 0 ? <input type="hidden" name="exclude" value={excludeKeys.join(",")} /> : null}
                    <input type="hidden" name="newExitLimit" value={newExitLimit == null ? "all" : String(newExitLimit)} />
                    <input type="hidden" name="newExitRevenueBand" value={newExitRevenueBand} />
                    {newExitFlagsOnly ? <input type="hidden" name="newExitFlagsOnly" value="1" /> : null}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {([
                        ["impact", "Impact"],
                        ["momentum", "Momentum"],
                        ["losers", "Verlierer"],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="submit"
                          name="moversPreset"
                          value={value}
                          style={{
                            border: moversPreset === value ? "1px solid rgba(125,211,252,0.28)" : "1px solid rgba(255,255,255,0.09)",
                            background: moversPreset === value ? "rgba(14,165,233,0.14)" : "rgba(255,255,255,0.03)",
                            color: moversPreset === value ? "#dbeafe" : "#f8fafc",
                            borderRadius: 999,
                            padding: "8px 12px",
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", justifyContent: "flex-end" }}>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#cbd5e1" }}>
                        <span>Anzahl</span>
                        <select name="moversLimit" defaultValue={moversLimit == null ? "all" : String(moversLimit)} style={selectInputStyle(110)}>
                          <option value="20">20</option>
                          <option value="50">50</option>
                          <option value="100">100</option>
                          <option value="all">Alle</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#cbd5e1" }}>
                        <span>Umsatz-Basis</span>
                        <select name="moversRevenueBand" defaultValue={moversRevenueBand} style={selectInputStyle(150)}>
                          <option value="all">Alle Umsaetze</option>
                          <option value="0-10">0-10k EUR</option>
                          <option value="10-20">10-20k EUR</option>
                          <option value="20-50">20-50k EUR</option>
                          <option value="50-plus">50k+ EUR</option>
                        </select>
                      </label>
                      <button type="submit" style={primarySmallButtonStyle()}>
                        Anwenden
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div style={{ ...cardStyle(), background: "#0f0f0f" }}>
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>Vergleichbare Parent-Produkte</div>
                  <div style={{ marginTop: 8, fontSize: 42, fontWeight: 900 }}>{num(moversBaseRows.length)}</div>
                  <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12 }}>nur mit Daten in M und M-1</div>
                </div>
                <div style={{ ...cardStyle(), background: "#0f0f0f" }}>
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>Positive Movers</div>
                  <div style={{ marginTop: 8, fontSize: 42, fontWeight: 900, color: "#22c55e" }}>{num(moversPositiveCount)}</div>
                  <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12 }}>Umsatz Delta &gt; 0</div>
                </div>
                <div style={{ ...cardStyle(), background: "#0f0f0f" }}>
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>Negative Movers</div>
                  <div style={{ marginTop: 8, fontSize: 42, fontWeight: 900, color: "#ef4444" }}>{num(moversNegativeCount)}</div>
                  <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12 }}>Umsatz Delta &lt; 0</div>
                </div>
              </div>

              <div style={{ ...cardStyle(), marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{moversPresetTitle}</div>
                    <div style={{ marginTop: 4, color: "#9ca3af", fontSize: 12 }}>
                      Spalten: Umsatz M, Umsatz M-1, Delta EUR, Delta %, Verkaeufe Delta, Preis Delta %, BSR Delta (kleiner besser), Reviews M + Delta.
                    </div>
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 12 }}>{num(moversVisible.length)} angezeigt</div>
                </div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {moversVisible.length === 0 ? (
                    <div style={{ color: "#9ca3af", fontSize: 13 }}>Keine Top Movers fuer den aktuellen Filter.</div>
                  ) : moversVisible.map((row) => (
                    <TopMoverRow key={row.parentProductId} row={row} />
                  ))}
                </div>
              </div>
            </>
          )}
        </SectionAccordion>
      </div>
    </main>
  );
}

function selectInputStyle(minWidth: number): CSSProperties {
  return {
    minWidth,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.03)",
    color: "#f8fafc",
    padding: "8px 10px",
  };
}

function primarySmallButtonStyle(): CSSProperties {
  return {
    border: "1px solid rgba(125,211,252,0.22)",
    background: "linear-gradient(135deg, rgba(59,130,246,0.92) 0%, rgba(14,165,233,0.92) 100%)",
    color: "#f8fafc",
    borderRadius: 12,
    padding: "9px 14px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  };
}

function SummaryBadge({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" | "negative" }) {
  const palette =
    tone === "positive"
      ? { border: "rgba(34,197,94,0.22)", bg: "rgba(34,197,94,0.12)", color: "#86efac" }
      : tone === "negative"
        ? { border: "rgba(239,68,68,0.22)", bg: "rgba(239,68,68,0.12)", color: "#fca5a5" }
        : { border: "rgba(255,255,255,0.08)", bg: "rgba(255,255,255,0.04)", color: "#e5e7eb" };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 999, border: `1px solid ${palette.border}`, background: palette.bg, color: palette.color, fontSize: 12, fontWeight: 800, lineHeight: 1 }}>
      {label ? <span style={{ color: "#8b8b8b" }}>{label}</span> : null}
      <span>{value}</span>
    </span>
  );
}

function SectionAccordion({
  id,
  eyebrow,
  title,
  description,
  badges,
  defaultOpen = false,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  badges?: { label: string; tone?: "default" | "positive" | "negative" }[];
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen} style={{ ...cardStyle(), padding: 0, overflow: "hidden" }}>
      <summary style={{ cursor: "pointer", listStyle: "none", padding: "18px 20px", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 16, background: "linear-gradient(135deg, rgba(255,255,255,0.06), transparent 32%, transparent 68%, rgba(255,255,255,0.04))", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ minWidth: 0 }}>
          {eyebrow ? <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase" }}>{eyebrow}</div> : null}
          <div
            style={{
              marginTop: eyebrow ? 6 : 0,
              fontSize: 24,
              lineHeight: 1.1,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-0.03em",
            }}
          >
            {title}
          </div>
          {description ? <div style={{ marginTop: 8, color: "#cbd5e1", fontSize: 13, maxWidth: 880 }}>{description}</div> : null}
          {badges && badges.length > 0 ? (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {badges.map((badge) => (
                <SummaryBadge key={badge.label} label="" value={badge.label} tone={badge.tone} />
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ width: 48, height: 48, borderRadius: 18, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.06)", display: "grid", placeItems: "center", color: "#f8fafc", fontSize: 22, fontWeight: 900 }}>↓</div>
      </summary>
      <div style={{ padding: 18 }}>{children}</div>
    </details>
  );
}

function FloatingWorkbenchMenu({
  selectedMonth,
  previousMonth,
  effectiveTokenCount,
  includeCount,
  excludeCount,
}: {
  selectedMonth: string | null;
  previousMonth: string | null;
  effectiveTokenCount: number;
  includeCount: number;
  excludeCount: number;
}) {
  const shortcuts = [
    { href: "#kpi", label: "KPI", kind: "grid" as const },
    { href: "#trends", label: "Trends", kind: "trend" as const },
    { href: "#current", label: "Marken & Produkte", kind: "clock" as const },
    { href: "#top-products", label: "Top 50 Produkte", kind: "list" as const },
    { href: "#growth", label: "Wachstum", kind: "trend" as const },
    { href: "#new-exit", label: "Neue / Exit", kind: "plusminus" as const },
    { href: "#movers", label: "Top Movers", kind: "list" as const },
  ];

  return (
    <details style={{ position: "fixed", top: 12, left: 12, zIndex: 60 }}>
      <summary style={{ listStyle: "none", width: 56, height: 56, borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(180deg, rgba(10,10,10,0.96) 0%, rgba(5,5,5,0.96) 100%)", boxShadow: "0 12px 28px rgba(0,0,0,0.38)", display: "grid", placeItems: "center", cursor: "pointer", color: "#f8fafc", backdropFilter: "blur(12px)" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      </summary>

      <div style={{ marginTop: 10, width: 236, maxWidth: "calc(100vw - 24px)", maxHeight: "calc(100vh - 92px)", overflowY: "auto", borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(180deg, rgba(10,10,10,0.98) 0%, rgba(5,5,5,0.98) 100%)", boxShadow: "0 22px 56px rgba(0,0,0,0.52)", backdropFilter: "blur(16px)", overflowX: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "#71717a", fontWeight: 800 }}>Navigation</div>
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div style={miniContextCardStyleCompact()}>
                <div style={miniContextLabelStyleCompact()}>Monat</div>
                <div style={miniContextValueStyleCompact()}>{formatMonth(selectedMonth)}</div>
              </div>
              <div style={miniContextCardStyleCompact()}>
                <div style={miniContextLabelStyleCompact()}>Vergleich</div>
                <div style={miniContextValueStyleCompact()}>{previousMonth ? formatMonth(previousMonth) : "n/a"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={floatingChipStyleCompact()}>{effectiveTokenCount} Scope</span>
              {includeCount > 0 ? <span style={floatingChipStyleCompact("positive")}>{includeCount} an</span> : null}
              {excludeCount > 0 ? <span style={floatingChipStyleCompact("negative")}>{excludeCount} aus</span> : null}
            </div>
          </div>
        </div>

        <Link href="/main" style={{ display: "grid", gridTemplateColumns: "40px 1fr", alignItems: "center", gap: 10, textDecoration: "none", color: "#f8fafc", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", padding: "9px 10px", margin: 10, marginBottom: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", display: "grid", placeItems: "center", color: "#e4e4e7", background: "rgba(255,255,255,0.02)" }}>
            <SidebarIcon kind="home" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Main</div>
            <div style={{ marginTop: 1, fontSize: 11, color: "#8b8b93", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>zurueck zum Dashboard</div>
          </div>
        </Link>

        <nav style={{ padding: 10, display: "grid", gap: 8 }}>
          {shortcuts.map((item) => (
            <a key={item.href} href={item.href} style={{ display: "grid", gridTemplateColumns: "40px 1fr", alignItems: "center", gap: 10, textDecoration: "none", color: "#f8fafc", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", padding: "9px 10px" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", display: "grid", placeItems: "center", color: "#e4e4e7", background: "rgba(255,255,255,0.02)" }}>
                <WorkbenchShortcutGlyph kind={item.kind} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900 }}>{item.label}</div>
                <div style={{ marginTop: 1, fontSize: 11, color: "#8b8b93", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Direkt zum Modul</div>
              </div>
            </a>
          ))}
        </nav>
      </div>
    </details>
  );
}

function miniContextCardStyleCompact(): CSSProperties {
  return { borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", padding: "8px 9px" };
}

function miniContextLabelStyleCompact(): CSSProperties {
  return { fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#71717a", fontWeight: 800 };
}

function miniContextValueStyleCompact(): CSSProperties {
  return { marginTop: 4, fontSize: 13, fontWeight: 800, color: "#f8fafc" };
}

function floatingChipStyleCompact(variant: "default" | "positive" | "negative" = "default"): CSSProperties {
  const palette =
    variant === "positive"
      ? { border: "rgba(34,197,94,0.22)", bg: "rgba(34,197,94,0.12)", color: "#86efac" }
      : variant === "negative"
        ? { border: "rgba(239,68,68,0.22)", bg: "rgba(239,68,68,0.12)", color: "#fca5a5" }
        : { border: "rgba(255,255,255,0.08)", bg: "rgba(255,255,255,0.04)", color: "#d4d4d8" };

  return { borderRadius: 999, border: `1px solid ${palette.border}`, background: palette.bg, color: palette.color, padding: "5px 8px", fontSize: 11, fontWeight: 700, lineHeight: 1 };
}

function WorkbenchShortcutGlyph({ kind }: { kind: "grid" | "trend" | "clock" | "plusminus" | "list" }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "grid") return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg>;
  if (kind === "clock") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></svg>;
  if (kind === "plusminus") return <svg {...common}><path d="M12 5v8" /><path d="M8 9h8" /><path d="M7 18h10" /></svg>;
  if (kind === "list") return <svg {...common}><path d="M6 7h12" /><path d="M6 12h12" /><path d="M6 17h12" /><path d="M3 7h.01" /><path d="M3 12h.01" /><path d="M3 17h.01" /></svg>;
  return <svg {...common}><path d="M4 17h16" /><path d="m6 14 4-4 3 2 5-6" /></svg>;
}

type SidebarIconKind = "home" | "kpi" | "trends" | "current" | "growth" | "newexit" | "movers";

function SidebarIcon({ kind }: { kind: SidebarIconKind }) {
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "#d4d4d8", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (kind === "home") return <svg {...common}><path d="M2.5 7.2 8 2.8l5.5 4.4" /><path d="M4.5 6.8v6.2h7V6.8" /></svg>;
  if (kind === "kpi") return <svg {...common}><rect x="2.5" y="2.5" width="4" height="4" rx="0.8" /><rect x="9.5" y="2.5" width="4" height="4" rx="0.8" /><rect x="2.5" y="9.5" width="4" height="4" rx="0.8" /><rect x="9.5" y="9.5" width="4" height="4" rx="0.8" /></svg>;
  if (kind === "trends") return <svg {...common}><path d="M2.5 12.5h11" /><path d="M3.5 10.5 6.7 7.6l2.4 2.2 3.4-4.8" /></svg>;
  if (kind === "current") return <svg {...common}><circle cx="8" cy="8" r="5.5" /><path d="M8 8V2.5" /><path d="M8 8 12.6 10.8" /></svg>;
  if (kind === "growth") return <svg {...common}><path d="M3 12.5h10" /><path d="M4 10.5 7.2 7.3l2.1 2.1L13 5.5" /></svg>;
  if (kind === "newexit") return <svg {...common}><path d="M3 5.2h10" /><path d="M8 2.7v5" /><path d="M3.5 11.5h9" /></svg>;
  return <svg {...common}><path d="M3 4.5h10" /><path d="M3 8h10" /><path d="M3 11.5h10" /><circle cx="5.5" cy="4.5" r="1" fill="#d4d4d8" stroke="none" /><circle cx="10.5" cy="8" r="1" fill="#d4d4d8" stroke="none" /><circle cx="7.5" cy="11.5" r="1" fill="#d4d4d8" stroke="none" /></svg>;
}

function signedMetricValue(value: number | null | undefined, mode: "currency" | "number") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  const absValue = Math.abs(value);
  return mode === "currency" ? `${prefix}${eur(absValue)}` : `${prefix}${num(absValue)}`;
}

function signedPercentLabel(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${pctFromFraction(Math.abs(value))}`;
}

function GrowthDeltaCard({ title, value, pct, mode, currentValue, previousValue }: { title: string; value: number | null; pct: number | null; mode: "currency" | "number"; currentValue: number | null; previousValue: number | null; }) {
  return (
    <div style={{ ...cardStyle(), padding: 14, background: "#0f0f0f" }}>
      <div style={{ color: "#9ca3af", fontSize: 13 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: trendColor(value) }}>{signedMetricValue(value, mode)}</div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, color: trendColor(value), fontWeight: 800, fontSize: 13 }}>
        <span>{value == null ? "•" : value > 0 ? "▲" : value < 0 ? "▼" : "•"}</span>
        <span>{signedPercentLabel(pct)}</span>
      </div>
      <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12 }}>
        aktuell {mode === "currency" ? eur(currentValue) : num(currentValue)} · VM {mode === "currency" ? eur(previousValue) : num(previousValue)}
      </div>
    </div>
  );
}

function GrowthBreakdownBar({ newValue, existingValue, exitValue, newCount, existingCount, exitCount }: { newValue: number; existingValue: number; exitValue: number; newCount: number; existingCount: number; exitCount: number; }) {
  const segments = [
    { label: "Neu", value: Math.max(newValue, 0), displayValue: newValue, color: "#22c55e", count: newCount },
    { label: "Bestehend", value: Math.max(Math.abs(existingValue), 0), displayValue: existingValue, color: existingValue >= 0 ? "#60a5fa" : "#3b82f6", count: existingCount },
    { label: "Exit", value: Math.max(exitValue, 0), displayValue: -exitValue, color: "#ef4444", count: exitCount },
  ];
  const total = Math.max(segments.reduce((acc, segment) => acc + segment.value, 0), 1);
  const baseX = 40;
  const baseY = 28;
  const barWidth = 540;
  const barHeight = 28;
  const netValue = newValue + existingValue - exitValue;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <svg width="100%" height="96" viewBox="0 0 620 96" role="img" aria-label="Wachstums-Breakdown">
        <text x="310" y="18" textAnchor="middle" fill="#9ca3af" fontSize="11">Zusammensetzung von links nach rechts: Neu, Bestehend, Exit</text>
        <rect x={baseX} y={baseY} width={barWidth} height={barHeight} rx={10} fill="#111827" />
        {(() => {
          let consumed = 0;
          return segments.map((segment) => {
            const width = (segment.value / total) * barWidth;
            const x = baseX + consumed;
            consumed += width;
            return <rect key={segment.label} x={x} y={baseY} width={width} height={barHeight} rx={10} fill={segment.color} />;
          });
        })()}
        {(() => {
          let consumed = 0;
          return segments.map((segment) => {
            const width = (segment.value / total) * barWidth;
            const centerX = baseX + consumed + width / 2;
            consumed += width;
            return width >= 64 ? <text key={`label-${segment.label}`} x={centerX} y={baseY + 18} textAnchor="middle" fill="#0b0b0b" fontSize="11" fontWeight="800">{segment.label}</text> : null;
          });
        })()}
        <text x="310" y="88" textAnchor="middle" fill="#f5f5f5" fontSize="12" fontWeight="700">Netto: {signedMetricValue(netValue, "currency")}</text>
      </svg>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {segments.map((segment) => (
          <GrowthLegendItem key={segment.label} label={segment.label} value={segment.displayValue} color={segment.color} count={segment.count} />
        ))}
      </div>
    </div>
  );
}

function GrowthLegendItem({ label, value, color, count }: { label: string; value: number; color: string; count: number }) {
  return (
    <div style={{ border: "1px solid #1f2937", borderRadius: 12, padding: 12, background: "#0b0b0b" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: color, display: "inline-block" }} />
        <span style={{ color: "#9ca3af", fontSize: 12 }}>{label}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color }}>{signedMetricValue(value, "currency")}</div>
      <div style={{ marginTop: 4, color: "#6b7280", fontSize: 11 }}>{num(count)} Parent-Produkte</div>
    </div>
  );
}

function GrowthFocusCard({ title, share, value, total }: { title: string; share: number | null; value: number; total: number }) {
  return (
    <div style={{ border: "1px solid #1f2937", borderRadius: 14, padding: 14, background: "#0b0b0b" }}>
      <div style={{ color: "#9ca3af", fontSize: 12 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900 }}>{share == null ? "n/a" : pctFromFraction(share)}</div>
      <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 11 }}>{compactCurrency(value)} von {compactCurrency(total)} positivem Wachstum</div>
    </div>
  );
}

function GrowthDriversList({ rows }: { rows: { key: string; asin: string; title: string; brand: string; href: string; externalUrl?: string | null; imageUrl?: string | null; delta: number; share: number; }[]; }) {
  if (rows.length === 0) return <div style={{ border: "1px dashed #2a2a2a", borderRadius: 14, padding: 16, color: "#9ca3af" }}>Kein positives Wachstum im Vergleich zum Vormonat.</div>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((row, index) => (
        <div key={row.key} style={{ display: "grid", gridTemplateColumns: "48px minmax(0,1fr) auto auto", gap: 10, alignItems: "center", borderTop: index === 0 ? "none" : "1px solid #1f2937", paddingTop: index === 0 ? 0 : 8 }}>
          <div><ProductThumb imageUrl={row.imageUrl ?? null} title={row.title} size={44} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Link href={row.href} style={{ color: "#dbeafe", fontWeight: 800, textDecoration: "none" }}>{row.asin}</Link>
              {row.externalUrl ? <a href={row.externalUrl} target="_blank" rel="noreferrer" style={{ color: "#93c5fd", fontSize: 12, textDecoration: "underline" }}>Produktlink</a> : null}
              <span style={{ color: "#9ca3af", fontSize: 12 }}>· {row.brand}</span>
            </div>
            <div style={{ marginTop: 3, color: "#e5e7eb", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.title}</div>
          </div>
          <div style={{ color: "#22c55e", fontSize: 12, fontWeight: 800, textAlign: "right" }}>{signedMetricValue(row.delta, "currency")}</div>
          <div style={{ color: "#f5f5f5", fontWeight: 800, fontSize: 12, textAlign: "right" }}>{pctFromFraction(row.share)}</div>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ title, value, subtitle, delta }: { title: string; value: string; subtitle: string; delta: number | null }) {
  return (
    <div style={{ ...cardStyle(), padding: 14, background: "#0f0f0f" }}>
      <div style={{ color: "#9ca3af", fontSize: 13 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900 }}>{value}</div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, color: trendColor(delta), fontWeight: 800, fontSize: 13 }}>
        <span>{delta == null ? "•" : delta > 0 ? "▲" : delta < 0 ? "▼" : "•"}</span>
        <span>{delta == null ? "n/a" : pctFromFraction(Math.abs(delta))}</span>
      </div>
      <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12 }}>{subtitle}</div>
    </div>
  );
}

function TrendCard({ title, valueNow, values, labels, mode }: { title: string; valueNow: string; values: (number | null)[]; labels: string[]; mode: "currency" | "number"; }) {
  const width = Math.max(420, labels.length * 88);
  const height = 190;
  const padding = 24;
  const path = seriesPath(values, width, height, padding);
  const meta = normalizePointMeta(values, width, height, padding);
  return (
    <div style={{ border: "1px solid #242424", borderRadius: 16, padding: 14, background: "#0b0b0b", minWidth: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800 }}>{title}</div>
          <div style={{ marginTop: 4, color: "#9ca3af", fontSize: 12 }}>{labels.length} Monate im Trendfenster</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{valueNow}</div>
      </div>
      <div style={{ marginTop: 12, width: "100%", overflow: "hidden" }}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} style={{ display: "block", width: "100%", height }}>
          <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="#1f2937" strokeWidth="1" />
          <line x1={padding} x2={padding} y1={padding} y2={height - padding} stroke="#1f2937" strokeWidth="1" />
          {path ? <path d={path} fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /> : null}
          {values.map((value, index) => {
            if (typeof value !== "number" || !Number.isFinite(value)) return null;
            const x = padding + index * meta.step;
            const y = pointY(value, meta.min, meta.max, height, padding);
            const labelY = Math.max(14, y - 10);
            return (
              <g key={`${labels[index]}-${index}`}>
                <text x={x} y={labelY} textAnchor="middle" fill="#dbeafe" fontSize="11" fontWeight="700">{formatPointValue(value, mode)}</text>
                <circle cx={x} cy={y} r="3.5" fill="#93c5fd" />
              </g>
            );
          })}
          {labels.map((label, index) => {
            const x = padding + index * meta.step;
            return <text key={label} x={x} y={height - 6} textAnchor="middle" fill="#6b7280" fontSize="11">{monthLabelShort(label)}</text>;
          })}
        </svg>
      </div>
    </div>
  );
}

function CompactShareDonut({ slices, total, colors, centerLabel }: { slices: PieSlice[]; total: number; colors: string[]; centerLabel: string; }) {
  if (slices.length === 0 || total <= 0) return <div style={{ border: "1px dashed #2a2a2a", borderRadius: 14, padding: 16, color: "#9ca3af" }}>Keine Anteile verfuegbar.</div>;
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
      <svg width="180" height="180" viewBox="0 0 240 240" role="img" aria-label={centerLabel}>
        <circle cx="120" cy="120" r="78" fill="#0b0b0b" stroke="#1f2937" strokeWidth="1" />
        {(() => {
          let startAngle = 0;
          return slices.map((slice, index) => {
            const sweep = (slice.value / total) * 360;
            const path = arcPath(120, 120, 78, startAngle, startAngle + sweep);
            startAngle += sweep;
            return <path key={slice.label} d={path} fill={colors[index % colors.length]} stroke="#0b0b0b" strokeWidth="2" />;
          });
        })()}
        <circle cx="120" cy="120" r="46" fill="#111111" stroke="#0b0b0b" strokeWidth="2" />
        <text x="120" y="112" textAnchor="middle" fill="#9ca3af" fontSize="11">{centerLabel}</text>
        <text x="120" y="130" textAnchor="middle" fill="#f5f5f5" fontSize="14" fontWeight="700">{compactCurrency(total)}</text>
      </svg>
    </div>
  );
}

function ShareLegendList({ rows, colors, showColumnLabels = false }: { rows: { key: string; label: string; title?: string; sublabel?: string; share: number; delta: number | null; imageUrl?: string | null; href?: string; externalUrl?: string | null; }[]; colors: string[]; showColumnLabels?: boolean; }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {showColumnLabels ? <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 10, alignItems: "end", color: "#6b7280", fontSize: 10, fontWeight: 700, paddingBottom: 2 }}><div /><div style={{ textAlign: "right" }}>MoM Umsatz</div><div style={{ textAlign: "right" }}>Anteil am Scope-Umsatz</div></div> : null}
      {rows.map((row, index) => (
        <div key={row.key} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 10, alignItems: "center", borderTop: index === 0 ? "none" : "1px solid #1f2937", paddingTop: index === 0 ? 0 : 8 }}>
          <div style={{ minWidth: 0, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ width: 12, height: 12, borderRadius: 999, background: colors[index % colors.length], display: "inline-block", flex: "0 0 auto" }} />
            {row.imageUrl ? <ProductThumb imageUrl={row.imageUrl} title={row.title ?? row.label} size={40} /> : null}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {row.href ? <Link href={row.href} style={{ color: "#dbeafe", fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>{row.label}</Link> : <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.label}</div>}
                {row.externalUrl ? <a href={row.externalUrl} target="_blank" rel="noreferrer" style={{ color: "#93c5fd", textDecoration: "none", fontSize: 11, whiteSpace: "nowrap" }}>Produktlink</a> : null}
              </div>
              {row.title ? <div style={{ color: "#e5e7eb", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.title}</div> : null}
              {row.sublabel ? <div style={{ color: "#9ca3af", fontSize: 11 }}>{row.sublabel}</div> : null}
            </div>
          </div>
          <div style={{ color: trendColor(row.delta), fontSize: 12, fontWeight: 800, textAlign: "right" }}>{row.delta == null ? "n/a" : pctFromFraction(row.delta)}</div>
          <div style={{ color: "#f5f5f5", fontWeight: 800, fontSize: 12, textAlign: "right" }}>{pctFromFraction(row.share)}</div>
        </div>
      ))}
    </div>
  );
}

function formatMetricValue(value: number | null | undefined, mode: "currency" | "number" | "rating") {
  if (mode === "currency") return eur(value ?? null);
  if (mode === "rating") {
    if (typeof value !== "number" || !Number.isFinite(value)) return "-";
    return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  }
  return num(value ?? null);
}

function CompactMetricCell({ title, value, previous, delta, mode }: { title: string; value: number | null; previous: number | null; delta: number | null; mode: "currency" | "number" | "rating" }) {
  return (
    <div style={{ minWidth: 0, display: "grid", gap: 3 }}>
      <div style={{ color: "#9ca3af", fontSize: 11 }}>{title}</div>
      <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.1 }}>{formatMetricValue(value, mode)}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", color: trendColor(delta), fontSize: 11, fontWeight: 800 }}>
        <span>{delta == null ? "•" : delta > 0 ? "▲" : delta < 0 ? "▼" : "•"}</span>
        <span>{delta == null ? "n/a" : pctFromFraction(Math.abs(delta))}</span>
      </div>
      <div style={{ color: "#6b7280", fontSize: 10 }}>VM {formatMetricValue(previous, mode)}</div>
    </div>
  );
}

function BsrMetricCell({ title, value, previous, deltaAbs }: { title: string; value: number | null; previous: number | null; deltaAbs: number | null }) {
  return (
    <div style={{ minWidth: 0, display: "grid", gap: 3 }}>
      <div style={{ color: "#9ca3af", fontSize: 11 }}>{title}</div>
      <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.1 }}>{num(value)}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", color: trendColor(deltaAbs, true), fontSize: 11, fontWeight: 800 }}>
        <span>{deltaAbs == null ? "•" : deltaAbs < 0 ? "▼" : deltaAbs > 0 ? "▲" : "•"}</span>
        <span>{deltaAbs == null ? "n/a" : num(Math.abs(deltaAbs))}</span>
      </div>
      <div style={{ color: "#6b7280", fontSize: 10 }}>VM {num(previous)}</div>
    </div>
  );
}

function ChildVariantList({ items }: { items: ProductChildRow[] }) {
  return (
    <details style={{ marginTop: 10, borderTop: "1px solid #1f2937", paddingTop: 10 }}>
      <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", fontWeight: 800, fontSize: 13 }}>
        <span>Child-Varianten anzeigen</span>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>{num(items.length)} Childs</span>
      </summary>
      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {items.map((item) => (
          <div key={item.asin} style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr) auto", gap: 10, alignItems: "center", border: "1px solid #141414", background: "#0b0b0b", borderRadius: 12, padding: 8 }}>
            <ProductThumb imageUrl={item.imageUrl} title={item.title ?? item.asin} size={52} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#dbeafe", fontWeight: 800, fontSize: 12 }}>{item.asin}</div>
              <div style={{ marginTop: 2, fontSize: 12, color: "#e5e7eb", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title ?? "Ohne Titel"}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: "#d1d5db" }}>
              <div><b>{eur(item.asinRevenue)}</b></div>
              <div style={{ color: "#9ca3af", marginTop: 2 }}>Preis {eur(item.price)}</div>
              <div style={{ color: "#9ca3af", marginTop: 2 }}>Reviews {num(item.reviewsCount)} · Rating {formatMetricValue(item.rating, "rating")}</div>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function CompactTrendGroup({ labels, revenueHistory, salesHistory, priceHistory }: { labels: string[]; revenueHistory: (number | null)[]; salesHistory: (number | null)[]; priceHistory: (number | null)[]; }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>Trends</div>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 8, alignItems: "center" }}><div style={{ color: "#9ca3af", fontSize: 10 }}>Ums.</div><MiniSparkline values={revenueHistory} labels={labels} mode="currency" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 8, alignItems: "center" }}><div style={{ color: "#9ca3af", fontSize: 10 }}>Stk.</div><MiniSparkline values={salesHistory} labels={labels} mode="number" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 8, alignItems: "center" }}><div style={{ color: "#9ca3af", fontSize: 10 }}>Preis</div><MiniSparkline values={priceHistory} labels={labels} mode="currency" /></div>
      </div>
    </div>
  );
}

function CompactProductRow({ row, labels }: { row: ProductDisplayRow; labels: string[] }) {
  return (
    <div style={{ border: "1px solid #1f2937", borderRadius: 16, background: "#101010", padding: 12 }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 1160, display: "grid", gridTemplateColumns: "72px minmax(260px, 2.2fr) repeat(6, minmax(92px, 0.92fr)) minmax(190px, 1.05fr)", gap: 12, alignItems: "center" }}>
          <ProductThumb imageUrl={row.imageUrl} title={row.title} size={72} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Link href={`/parents/${row.parentProductId}`} style={{ color: "#dbeafe", fontWeight: 900, textDecoration: "none" }}>{row.representativeAsin}</Link>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>· {row.brand}</span>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>· Anteil {pctFromFraction(row.share)}</span>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>· {num(row.childCount)} Childs</span>
              <DuplicateMarker info={row.duplicateInfo} />
              {row.representativeUrl ? <a href={row.representativeUrl} target="_blank" rel="noreferrer" style={{ color: "#93c5fd", textDecoration: "none", fontSize: 12 }}>Amazon</a> : null}
            </div>
            <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800, lineHeight: 1.35, color: "#f8fafc", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{row.title}</div>
          </div>
          <CompactMetricCell title="Umsatz" value={row.revenue} previous={row.previousRevenue} delta={row.revenueDelta} mode="currency" />
          <CompactMetricCell title="Verkaeufe" value={row.sales} previous={row.previousSales} delta={row.salesDelta} mode="number" />
          <CompactMetricCell title="Median Preis" value={row.priceMedian} previous={row.previousPriceMedian} delta={row.priceDelta} mode="currency" />
          <CompactMetricCell title="Bewertungsanzahl" value={row.reviewsCount} previous={row.previousReviewsCount} delta={row.reviewsDelta} mode="number" />
          <CompactMetricCell title="Bewertung" value={row.rating} previous={row.previousRating} delta={row.ratingDelta} mode="rating" />
          <BsrMetricCell title="BSR" value={row.bsrMedian} previous={row.previousBsrMedian} deltaAbs={row.bsrDeltaAbs} />
          <CompactTrendGroup labels={labels} revenueHistory={row.revenueHistory} salesHistory={row.salesHistory} priceHistory={row.priceHistory} />
        </div>
      </div>
      <ChildVariantList items={row.childVariants} />
    </div>
  );
}

function FlagPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "green" | "amber" }) {
  const background = tone === "green" ? "rgba(22, 163, 74, 0.18)" : tone === "amber" ? "rgba(245, 158, 11, 0.18)" : "rgba(59, 130, 246, 0.18)";
  const border = tone === "green" ? "#16a34a" : tone === "amber" ? "#f59e0b" : "#2563eb";
  const color = tone === "green" ? "#86efac" : tone === "amber" ? "#fcd34d" : "#bfdbfe";
  return <span style={{ padding: "4px 8px", borderRadius: 999, border: `1px solid ${border}`, background, color, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{label}</span>;
}

function NewExitProductRow({ asin, title, brand, imageUrl, href, externalUrl, mainMetricLabel, mainMetricValue, secondaryMetricLabel, secondaryMetricValue, secondaryMode, flags, childCount, childVariants }: { asin: string; title: string; brand: string; imageUrl: string | null; href: string; externalUrl: string | null; mainMetricLabel: string; mainMetricValue: number | null; secondaryMetricLabel: string; secondaryMetricValue: number | null; secondaryMode: "currency" | "number"; flags: string[]; childCount: number; childVariants: ProductChildRow[]; }) {
  return (
    <div style={{ border: "1px solid #1f2937", borderRadius: 16, background: "#101010", padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1.8fr) minmax(120px, 0.8fr) minmax(100px, 0.7fr)", gap: 12, alignItems: "center" }}>
        <ProductThumb imageUrl={imageUrl} title={title} size={72} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Link href={href} style={{ color: "#dbeafe", fontWeight: 900, textDecoration: "none" }}>{asin}</Link>
            <span style={{ color: "#9ca3af", fontSize: 12 }}>· {brand}</span>
            <span style={{ color: "#9ca3af", fontSize: 12 }}>· {num(childCount)} Childs</span>
            {externalUrl ? <a href={externalUrl} target="_blank" rel="noreferrer" style={{ color: "#93c5fd", textDecoration: "none", fontSize: 12 }}>Amazon</a> : null}
          </div>
          <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, lineHeight: 1.35, color: "#f8fafc", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>
          {flags.length > 0 ? <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>{flags.map((flag) => <FlagPill key={flag} label={flag} tone={flag === "Impact" ? "amber" : "green"} />)}</div> : null}
        </div>
        <div><div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>{mainMetricLabel}</div><div style={{ marginTop: 4, fontSize: 18, fontWeight: 900 }}>{eur(mainMetricValue)}</div></div>
        <div><div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>{secondaryMetricLabel}</div><div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>{secondaryMode === "currency" ? eur(secondaryMetricValue) : num(secondaryMetricValue)}</div></div>
      </div>
      <ChildVariantList items={childVariants} />
    </div>
  );
}

function ProductThumb({ imageUrl, title, size = 112 }: { imageUrl: string | null; title: string; size?: number }) {
  return imageUrl ? (
    <img src={imageUrl} alt={title} style={{ width: size, height: size, objectFit: "contain", borderRadius: 12, border: "1px solid #1f2937", background: "#ffffff" }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: 12, border: "1px dashed #374151", background: "#111827", color: "#9ca3af", display: "grid", placeItems: "center", fontSize: 11, textAlign: "center", padding: 6 }}>Kein Bild</div>
  );
}

function MiniSparkline({ values, labels, mode }: { values: (number | null)[]; labels: string[]; mode: "currency" | "number" }) {
  const width = Math.max(120, labels.length * 26);
  const height = 34;
  const padding = 8;
  const path = seriesPath(values, width, height, padding);
  const meta = normalizePointMeta(values, width, height, padding);
  const latestNumeric = [...values].reverse().find((value): value is number => typeof value === "number" && Number.isFinite(value));
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ color: "#9ca3af", fontSize: 10 }}>{latestNumeric == null ? "-" : formatPointValue(latestNumeric, mode)}</div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sparkline">
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="#1f2937" strokeWidth="1" />
        {path ? <path d={path} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {values.map((value, index) => {
          if (typeof value !== "number" || !Number.isFinite(value)) return null;
          const x = padding + index * meta.step;
          const y = pointY(value, meta.min, meta.max, height, padding);
          return <circle key={`${labels[index]}-${index}`} cx={x} cy={y} r="2.3" fill="#93c5fd" />;
        })}
      </svg>
    </div>
  );
}

type TopMoverDisplayRow = {
  parentProductId: string;
  representativeAsin: string;
  representativeUrl: string | null;
  imageUrl: string | null;
  title: string;
  brand: string;
  currentRevenue: number;
  previousRevenue: number;
  revenueDeltaAbs: number;
  revenueDeltaPct: number | null;
  currentSales: number | null;
  previousSales: number | null;
  salesDeltaAbs: number | null;
  currentPrice: number | null;
  previousPrice: number | null;
  priceDeltaPct: number | null;
  currentBsr: number | null;
  previousBsr: number | null;
  bsrDeltaAbs: number | null;
  currentReviews: number | null;
  previousReviews: number | null;
  reviewsDeltaAbs: number | null;
  baseRevenue: number;
  childCount: number;
  childVariants: ProductChildRow[];
};

function SmallDeltaValue({ value, mode, invertGood = false }: { value: number | null; mode: "currency" | "number" | "percent"; invertGood?: boolean }) {
  const color = trendColor(value, invertGood);
  let label = "n/a";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (mode === "currency") label = signedMetricValue(value, "currency");
    else if (mode === "number") label = value > 0 ? `+${num(value)}` : value < 0 ? `-${num(Math.abs(value))}` : num(0);
    else label = signedPercentLabel(value);
  }
  return <span style={{ color, fontWeight: 800 }}>{label}</span>;
}

function TopMoverCell({ title, value, detail, color }: { title: string; value: string; detail?: ReactNode; color?: string }) {
  return (
    <div style={{ minWidth: 0, display: "grid", gap: 3 }}>
      <div style={{ color: "#9ca3af", fontSize: 11 }}>{title}</div>
      <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.1, color: color ?? "#f5f5f5" }}>{value}</div>
      {detail ? <div style={{ fontSize: 10, color: "#6b7280" }}>{detail}</div> : <div style={{ fontSize: 10, color: "#6b7280" }}> </div>}
    </div>
  );
}

function TopMoverRow({ row }: { row: TopMoverDisplayRow }) {
  return (
    <div style={{ border: "1px solid #1f2937", borderRadius: 16, background: "#101010", padding: 12 }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 1240, display: "grid", gridTemplateColumns: "72px minmax(280px, 2.2fr) repeat(8, minmax(105px, 0.85fr))", gap: 12, alignItems: "center" }}>
          <ProductThumb imageUrl={row.imageUrl} title={row.title} size={72} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Link href={`/parents/${row.parentProductId}`} style={{ color: "#dbeafe", fontWeight: 900, textDecoration: "none" }}>{row.representativeAsin}</Link>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>· {row.brand}</span>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>· {num(row.childCount)} Childs</span>
              {row.representativeUrl ? <a href={row.representativeUrl} target="_blank" rel="noreferrer" style={{ color: "#93c5fd", textDecoration: "none", fontSize: 12 }}>Amazon</a> : null}
            </div>
            <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800, lineHeight: 1.35, color: "#f8fafc", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{row.title}</div>
          </div>
          <TopMoverCell title="Umsatz (M)" value={eur(row.currentRevenue)} detail={<span>aktuell</span>} />
          <TopMoverCell title="Umsatz (M-1)" value={eur(row.previousRevenue)} detail={<span>Vormonat</span>} />
          <TopMoverCell title="Umsatz Delta EUR" value={signedMetricValue(row.revenueDeltaAbs, "currency")} color={trendColor(row.revenueDeltaAbs)} detail={<span><SmallDeltaValue value={row.revenueDeltaPct} mode="percent" /></span>} />
          <TopMoverCell title="Umsatz Delta %" value={row.revenueDeltaPct == null ? "n/a" : signedPercentLabel(row.revenueDeltaPct)} color={trendColor(row.revenueDeltaPct)} detail={<span>vs. M-1</span>} />
          <TopMoverCell title="Verkaeufe Delta" value={typeof row.salesDeltaAbs === "number" ? row.salesDeltaAbs > 0 ? `+${num(row.salesDeltaAbs)}` : row.salesDeltaAbs < 0 ? `-${num(Math.abs(row.salesDeltaAbs))}` : num(0) : "n/a"} color={trendColor(row.salesDeltaAbs)} detail={<span>M {num(row.currentSales)} · VM {num(row.previousSales)}</span>} />
          <TopMoverCell title="Preis Delta %" value={row.priceDeltaPct == null ? "n/a" : signedPercentLabel(row.priceDeltaPct)} color={trendColor(row.priceDeltaPct)} detail={<span>M {eur(row.currentPrice)} · VM {eur(row.previousPrice)}</span>} />
          <TopMoverCell title="BSR Delta" value={row.bsrDeltaAbs == null ? "n/a" : row.bsrDeltaAbs > 0 ? `+${num(row.bsrDeltaAbs)}` : row.bsrDeltaAbs < 0 ? `-${num(Math.abs(row.bsrDeltaAbs))}` : num(0)} color={trendColor(row.bsrDeltaAbs, true)} detail={<span>kleiner besser · M {num(row.currentBsr)} · VM {num(row.previousBsr)}</span>} />
          <TopMoverCell title="Reviews (M)" value={num(row.currentReviews)} detail={<span>Delta {typeof row.reviewsDeltaAbs === "number" ? row.reviewsDeltaAbs > 0 ? `+${num(row.reviewsDeltaAbs)}` : row.reviewsDeltaAbs < 0 ? `-${num(Math.abs(row.reviewsDeltaAbs))}` : num(0) : "n/a"}</span>} />
        </div>
      </div>
      <ChildVariantList items={row.childVariants} />
    </div>
  );
}
