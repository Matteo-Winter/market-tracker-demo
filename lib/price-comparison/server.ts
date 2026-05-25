import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/prisma";
import {
  getPriceComparisonTemplate,
  getRelevantTemplateAsins,
  type PriceComparisonTemplateCategory,
  type PriceComparisonTemplateSlot,
} from "./template";

export type CompetitorMetricPoint = {
  snapshotDate: string;
  price: number | null;
  bsr: number | null;
  reviewCount: number | null;
  rating: number | null;
  asinRevenue: number | null;
};

type SnapshotMetric = {
  asin: string;
  title: string | null;
  brand: string | null;
  category: string | null;
  price: number | null;
  bsr: number | null;
  reviewCount: number | null;
  rating: number | null;
  asinRevenue: number | null;
  parentRevenue: number | null;
  asinSales: number | null;
  parentSales: number | null;
};

type LegacyWorkbookItem = {
  asin: string;
  title: string | null;
  brand: string | null;
  category: string | null;
  price: number | null;
  bsr: number | null;
  reviewCount: number | null;
  rating: number | null;
  asinRevenue: number | null;
};

export type PriceComparisonViewSlot = {
  brand: string | null;
  title: string | null;
  asin: string | null;
  link: string | null;
  amazonLink: string | null;
  imageUrl: string | null;
  comment: string | null;
  manualHint: boolean;
  manual: boolean;
  empty: boolean;
  hasMatch: boolean;
  current: SnapshotMetric | null;
  previous: SnapshotMetric | null;
  seed: {
    price: number | null;
    bsr: number | null;
    reviewCount: number | null;
    rating: number | null;
    asinRevenue: number | null;
  } | null;
  history: CompetitorMetricPoint[];
};

export type PriceComparisonViewRow = {
  label: string;
  itemNumber: string | null;
  slots: PriceComparisonViewSlot[];
};

export type PriceComparisonViewModel = {
  categories: Array<{ id: string; label: string }>;
  selectedCategory: PriceComparisonTemplateCategory | null;
  selectedSnapshotDate: string | null;
  previousSnapshotDate: string | null;
  latestSnapshotDate: string | null;
  snapshotOptions: Array<{
    id: string;
    snapshotDate: string;
    sourceFilename: string;
    totalItemCount: number;
    relevantMatchCount: number;
  }>;
  rows: PriceComparisonViewRow[];
  totalMatched: number;
  totalManual: number;
};

type CsvRecord = Record<string, string | undefined>;

function parseFloatSafe(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s/g, "").replace(",", ".").trim();
  if (!cleaned || cleaned === "-" || cleaned === "–") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntSafe(value: unknown): number | null {
  const parsed = parseFloatSafe(value);
  return parsed == null ? null : Math.round(parsed);
}

function cleanText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeAsin(value: unknown): string | null {
  const text = cleanText(value)?.toUpperCase() ?? null;
  if (!text) return null;
  return /^[A-Z0-9]{10}$/.test(text) ? text : null;
}

function isoWeekStartDate(year: number, week: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

function extractSnapshotDate(filename: string, fallbackYear?: number | null): string {
  const dateMatch = filename.match(/(20\d{2}-\d{2}-\d{2})/);
  if (dateMatch?.[1]) return dateMatch[1];

  const kwMatch = filename.match(/kw[\s_-]*0?(\d{1,2})/i);
  if (kwMatch?.[1]) {
    const filenameYearMatch = filename.match(/(20\d{2})/);
    const year = fallbackYear ?? (filenameYearMatch ? Number(filenameYearMatch[1]) : new Date().getUTCFullYear());
    return isoWeekStartDate(year, Number(kwMatch[1]));
  }

  return new Date().toISOString().slice(0, 10);
}

function seedMetric(slot: PriceComparisonTemplateSlot) {
  const metric = {
    price: parseFloatSafe(slot.seed?.price),
    bsr: parseIntSafe(slot.seed?.bsr),
    reviewCount: parseIntSafe(slot.seed?.reviewCount),
    rating: parseFloatSafe(slot.seed?.rating),
    asinRevenue: parseFloatSafe(slot.seed?.asinRevenue),
  };

  return Object.values(metric).some((value) => value != null) ? metric : null;
}

function amazonLink(asin: string | null, explicit: string | null) {
  return explicit ?? (asin ? `https://www.amazon.de/dp/${asin}` : null);
}

function amazonImageUrl(asin: string | null) {
  if (!asin) return null;
  return `https://m.media-amazon.com/images/P/${asin}.01._SL160_.jpg`;
}

function slotHasStructure(slot: PriceComparisonTemplateSlot) {
  return Boolean(
    slot.asin ||
      slot.link ||
      cleanText(slot.comment) ||
      slot.manualHint ||
      (slot.seed && Object.values(slot.seed).some((value) => value != null && value !== ""))
  );
}

function buildPythonCandidates() {
  const raw = [
    process.env.PRICE_COMPARISON_PYTHON?.trim(),
    process.env.PYTHON?.trim(),
    "/opt/homebrew/bin/python3",
    "/usr/local/bin/python3",
    "/usr/bin/python3",
    "python3",
    "python",
    "py",
  ].filter((value): value is string => Boolean(value));

  const unique = [...new Set(raw)];

  return unique.map((cmd) =>
    cmd === "py" ? { cmd, args: ["-3"] as string[] } : { cmd, args: [] as string[] }
  );
}

function runPythonJsonScript(scriptPath: string, args: string[]) {
  const candidates = buildPythonCandidates();
  let lastError: string | null = null;

  for (const candidate of candidates) {
    if (candidate.cmd.startsWith("/") && !fs.existsSync(candidate.cmd)) {
      continue;
    }

    const result = spawnSync(candidate.cmd, [...candidate.args, scriptPath, ...args], {
      cwd: process.cwd(),
      encoding: "utf-8",
    });

    if (result.error) {
      lastError = `${candidate.cmd}: ${result.error.message}`;
      continue;
    }

    if (result.status === 0) {
      const stdout = result.stdout?.trim();
      if (!stdout) return null;
      return JSON.parse(stdout);
    }

    lastError =
      result.stderr?.trim() ||
      result.stdout?.trim() ||
      `${candidate.cmd}: Exit code ${result.status}`;
  }

  throw new Error(
    `Historische Excel konnte nicht verarbeitet werden. Bitte Python + openpyxl prüfen. ${lastError ?? ""}`.trim()
  );
}

async function upsertSnapshot(snapshotDate: string, sourceFilename: string, values: SnapshotMetric[]) {
  await prisma.$transaction(async (tx) => {
    const snapshot = await tx.competitorSnapshot.upsert({
      where: { snapshotDate },
      create: {
        snapshotDate,
        sourceFilename,
      },
      update: {
        sourceFilename,
      },
      select: { id: true },
    });

    await tx.competitorSnapshotItem.deleteMany({
      where: { snapshotId: snapshot.id },
    });

    if (values.length > 0) {
      await tx.competitorSnapshotItem.createMany({
        data: values.map((item) => ({
          snapshotId: snapshot.id,
          asin: item.asin,
          title: item.title,
          brand: item.brand,
          category: item.category,
          price: item.price,
          bsr: item.bsr,
          reviewCount: item.reviewCount,
          rating: item.rating,
          asinRevenue: item.asinRevenue,
          parentRevenue: item.parentRevenue,
          asinSales: item.asinSales,
          parentSales: item.parentSales,
        })),
      });
    }
  });
}

export async function importCompetitorCsv(input: {
  filename: string;
  csvText: string;
}) {
  const relevantAsins = getRelevantTemplateAsins();
  const snapshotDate = extractSnapshotDate(input.filename);
  const rows = parse(input.csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as CsvRecord[];

  const byAsin = new Map<string, SnapshotMetric>();
  let ignoredCount = 0;

  for (const row of rows) {
    const asin = normalizeAsin(row["ASIN"]);
    if (!asin || !relevantAsins.has(asin)) {
      ignoredCount += 1;
      continue;
    }

    byAsin.set(asin, {
      asin,
      title: cleanText(row["Title"]),
      brand: cleanText(row["Brand"]),
      category: cleanText(row["Category"]),
      price: parseFloatSafe(row["Price"]),
      bsr: parseIntSafe(row["BSR"]),
      reviewCount: parseIntSafe(row["Review Count"]),
      rating: parseFloatSafe(row["Reviews Rating"]),
      asinRevenue: parseFloatSafe(row["ASIN Revenue"]),
      parentRevenue: parseFloatSafe(row["Parent Level Revenue"]),
      asinSales: parseIntSafe(row["ASIN Sales"]),
      parentSales: parseIntSafe(row["Parent Level Sales"]),
    });
  }

  const values = [...byAsin.values()];

  if (values.length === 0) {
    throw new Error("Die CSV enthält keine relevanten ASINs aus der Preisvergleichs-Vorlage.");
  }

  await upsertSnapshot(snapshotDate, input.filename, values);

  return {
    snapshotDate,
    matchedCount: values.length,
    ignoredCount,
  };
}

export async function importHistoricWorkbook(input: {
  filename: string;
  workbookPath: string;
  year?: number | null;
}) {
  const relevantAsins = getRelevantTemplateAsins();
  const snapshotDate = extractSnapshotDate(input.filename, input.year ?? null);
  const scriptPath = path.join(process.cwd(), "scripts", "price_comparison_import_legacy.py");

  if (!fs.existsSync(scriptPath)) {
    throw new Error('Das Script "scripts/price_comparison_import_legacy.py" fehlt.');
  }

  const parsed = runPythonJsonScript(scriptPath, [input.workbookPath]) as { items?: LegacyWorkbookItem[] } | null;
  const items = Array.isArray(parsed?.items) ? parsed!.items : [];

  const byAsin = new Map<string, SnapshotMetric>();
  let ignoredCount = 0;

  for (const item of items) {
    const asin = normalizeAsin(item.asin);
    if (!asin || !relevantAsins.has(asin)) {
      ignoredCount += 1;
      continue;
    }

    byAsin.set(asin, {
      asin,
      title: cleanText(item.title),
      brand: cleanText(item.brand),
      category: cleanText(item.category),
      price: item.price ?? null,
      bsr: item.bsr ?? null,
      reviewCount: item.reviewCount ?? null,
      rating: item.rating ?? null,
      asinRevenue: item.asinRevenue ?? null,
      parentRevenue: null,
      asinSales: null,
      parentSales: null,
    });
  }

  const values = [...byAsin.values()];

  if (values.length === 0) {
    throw new Error("Die historische Excel enthält keine relevanten ASINs aus der Preisvergleichs-Vorlage.");
  }

  await upsertSnapshot(snapshotDate, input.filename, values);

  return {
    snapshotDate,
    matchedCount: values.length,
    ignoredCount,
  };
}

export async function loadPriceComparisonView(input: {
  categoryId: string | null;
  snapshotDate: string | null;
}): Promise<PriceComparisonViewModel> {
  const template = getPriceComparisonTemplate();
  const categories = template.map((category) => ({
    id: category.id,
    label: category.label,
  }));

  const selectedCategory =
    template.find((category) => category.id === input.categoryId || category.label === input.categoryId) ??
    template[0] ??
    null;

  const snapshotRows = await prisma.competitorSnapshot.findMany({
    orderBy: { snapshotDate: "desc" },
    select: {
      id: true,
      snapshotDate: true,
      sourceFilename: true,
    },
  });

  const selectedSnapshot =
    snapshotRows.find((snapshot) => snapshot.snapshotDate === input.snapshotDate) ?? snapshotRows[0] ?? null;

  const selectedSnapshotDate = selectedSnapshot?.snapshotDate ?? null;
  const latestSnapshotDate = snapshotRows[0]?.snapshotDate ?? null;
  const selectedSnapshotIndex = selectedSnapshot
    ? snapshotRows.findIndex((snapshot) => snapshot.snapshotDate === selectedSnapshot.snapshotDate)
    : -1;
  const previousSnapshot = selectedSnapshotIndex >= 0 ? snapshotRows[selectedSnapshotIndex + 1] ?? null : null;
  const previousSnapshotDate = previousSnapshot?.snapshotDate ?? null;

  const relevantAsins = selectedCategory
    ? [
        ...new Set(
          selectedCategory.rows.flatMap((row) =>
            row.slots.map((slot) => slot.asin).filter((value): value is string => Boolean(value))
          )
        ),
      ]
    : [];

  const snapshotOptions = await Promise.all(
    snapshotRows.map(async (snapshot) => {
      const [totalItemCount, relevantMatchCount] = await Promise.all([
        prisma.competitorSnapshotItem.count({ where: { snapshotId: snapshot.id } }),
        relevantAsins.length
          ? prisma.competitorSnapshotItem.count({
              where: {
                snapshotId: snapshot.id,
                asin: { in: relevantAsins },
              },
            })
          : Promise.resolve(0),
      ]);

      return {
        id: snapshot.id,
        snapshotDate: snapshot.snapshotDate,
        sourceFilename: snapshot.sourceFilename,
        totalItemCount,
        relevantMatchCount,
      };
    })
  );

  if (!selectedCategory) {
    return {
      categories,
      selectedCategory: null,
      selectedSnapshotDate,
      previousSnapshotDate,
      latestSnapshotDate,
      snapshotOptions,
      rows: [],
      totalMatched: 0,
      totalManual: 0,
    };
  }

  const historySnapshots = [...snapshotRows].slice(0, 8).reverse();
  const historyItems =
    relevantAsins.length === 0 || historySnapshots.length === 0
      ? []
      : await prisma.competitorSnapshotItem.findMany({
          where: {
            asin: { in: relevantAsins },
            snapshotId: { in: historySnapshots.map((snapshot) => snapshot.id) },
          },
          select: {
            asin: true,
            title: true,
            brand: true,
            category: true,
            price: true,
            bsr: true,
            reviewCount: true,
            rating: true,
            asinRevenue: true,
            parentRevenue: true,
            asinSales: true,
            parentSales: true,
            snapshot: {
              select: {
                snapshotDate: true,
              },
            },
          },
        });

  const historyByAsin = new Map<string, Map<string, SnapshotMetric>>();

  for (const item of historyItems) {
    const perSnapshot = historyByAsin.get(item.asin) ?? new Map<string, SnapshotMetric>();
    perSnapshot.set(item.snapshot.snapshotDate, {
      asin: item.asin,
      title: item.title,
      brand: item.brand,
      category: item.category,
      price: item.price,
      bsr: item.bsr,
      reviewCount: item.reviewCount,
      rating: item.rating,
      asinRevenue: item.asinRevenue,
      parentRevenue: item.parentRevenue,
      asinSales: item.asinSales,
      parentSales: item.parentSales,
    });
    historyByAsin.set(item.asin, perSnapshot);
  }

  let totalMatched = 0;
  let totalManual = 0;

  const rows: PriceComparisonViewRow[] = selectedCategory.rows.map((row) => ({
    label: row.label,
    itemNumber: row.itemNumber,
    slots: row.slots.map((slot) => {
      const seed = seedMetric(slot);
      const current =
        slot.asin && selectedSnapshotDate
          ? historyByAsin.get(slot.asin)?.get(selectedSnapshotDate) ?? null
          : null;
      const previous =
        slot.asin && previousSnapshotDate
          ? historyByAsin.get(slot.asin)?.get(previousSnapshotDate) ?? null
          : null;
      const history =
        slot.asin == null
          ? []
          : historySnapshots
              .map((snapshot) => {
                const point = historyByAsin.get(slot.asin!)?.get(snapshot.snapshotDate) ?? null;
                return point
                  ? {
                      snapshotDate: snapshot.snapshotDate,
                      price: point.price,
                      bsr: point.bsr,
                      reviewCount: point.reviewCount,
                      rating: point.rating,
                      asinRevenue: point.asinRevenue,
                    }
                  : null;
              })
              .filter((value): value is CompetitorMetricPoint => Boolean(value));

      const structureExists = slotHasStructure(slot);
      const hasMatch = Boolean(current);
      const manual = Boolean(slot.manualHint || (!hasMatch && slot.asin));
      const empty = !structureExists;

      if (hasMatch) totalMatched += 1;
      if (manual) totalManual += 1;

      return {
        brand: current?.brand ?? slot.brand,
        title: current?.title ?? null,
        asin: slot.asin,
        link: slot.link,
        amazonLink: amazonLink(slot.asin, slot.link),
        imageUrl: amazonImageUrl(slot.asin),
        comment: cleanText(slot.comment),
        manualHint: slot.manualHint,
        manual,
        empty,
        hasMatch,
        current,
        previous,
        seed,
        history,
      };
    }),
  }));

  return {
    categories,
    selectedCategory,
    selectedSnapshotDate,
    previousSnapshotDate,
    latestSnapshotDate,
    snapshotOptions,
    rows,
    totalMatched,
    totalManual,
  };
}
