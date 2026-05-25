export const dynamic = "force-dynamic";

import Link from "next/link";
import DeleteSnapshotButton from "./DeleteSnapshotButton";
import RowChartClient from "./RowChartClient";
import {
  loadPriceComparisonView,
  type PriceComparisonViewRow,
  type PriceComparisonViewSlot,
} from "@/lib/price-comparison/server";

type SearchParams = {
  category?: string | string[];
  snapshot?: string | string[];
  chart?: string | string[];
  imported?: string | string[];
  legacyImported?: string | string[];
  matched?: string | string[];
  ignored?: string | string[];
  error?: string | string[];
};

type Props = {
  searchParams?: Promise<SearchParams>;
};

type ChartMetric = "price" | "bsr";

const VIOLET = "#a78bfa";
const VIOLET_BORDER = "rgba(167,139,250,0.40)";
const VIOLET_BG = "rgba(167,139,250,0.12)";
const VIOLET_TEXT = "#efe7ff";

function one(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

function normalizeChartMetric(value: string | null): ChartMetric {
  return value === "bsr" ? "bsr" : "price";
}

function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoWeekInfo(value: string | null) {
  const date = parseDate(value);
  if (!date) return null;
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: utc.getUTCFullYear(), week };
}

function formatDateLabel(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "–";
  const [y, m, d] = value.split("-");
  return `${d}.${m}.${y}`;
}

function formatSnapshotChipLabel(value: string | null) {
  const week = isoWeekInfo(value);
  const date = formatDateLabel(value);
  if (!week) return date;
  return `KW ${week.week} · ${date}`;
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "–";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "–";
  return new Intl.NumberFormat("de-DE").format(value);
}

function formatRating(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "–";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function metricValue(slot: PriceComparisonViewSlot, key: "price" | "bsr" | "reviewCount" | "rating") {
  return slot.current?.[key] ?? slot.seed?.[key] ?? null;
}

function buildHref(input: { category?: string | null; snapshot?: string | null; chart?: ChartMetric }) {
  const params = new URLSearchParams();
  if (input.category) params.set("category", input.category);
  if (input.snapshot) params.set("snapshot", input.snapshot);
  if (input.chart) params.set("chart", input.chart);
  const query = params.toString();
  return query ? `/price-comparison?${query}` : "/price-comparison";
}

function statusColor(slot: PriceComparisonViewSlot) {
  if (slot.empty) return "#26292d";
  if (slot.manual) return "rgba(208, 180, 109, 0.48)";
  if (slot.hasMatch) return VIOLET_BORDER;
  return "#34373c";
}

function deltaRatio(current: number | null | undefined, previous: number | null | undefined, invert = false) {
  if (
    typeof current !== "number" ||
    !Number.isFinite(current) ||
    typeof previous !== "number" ||
    !Number.isFinite(previous) ||
    previous === 0
  ) {
    return null;
  }

  return invert ? (previous - current) / previous : (current - previous) / previous;
}

function deltaLabel(delta: number | null) {
  if (delta == null) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "always",
  }).format(delta);
}

function deltaColor(delta: number | null) {
  if (delta == null) return "#7c8390";
  if (delta > 0) return "#86efac";
  if (delta < 0) return "#fca5a5";
  return "#cbd5e1";
}

function tinyLabelStyle() {
  return {
    color: "#8a9098",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
  };
}

function MetricCell(props: {
  label: string;
  value: string;
  delta?: string | null;
  deltaTone?: string;
  full?: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid #202327",
        background: "#0f1113",
        padding: "7px 8px",
        minWidth: 0,
        gridColumn: props.full ? "1 / -1" : undefined,
      }}
    >
      <div style={tinyLabelStyle()}>{props.label}</div>
      <div
        style={{
          marginTop: 3,
          color: "#f6f7f8",
          fontSize: props.full ? 11 : 12,
          fontWeight: 800,
          minHeight: 17,
          whiteSpace: props.full ? "normal" : "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.3,
        }}
      >
        {props.value}
      </div>
      {!props.full ? (
        <div
          style={{
            marginTop: 2,
            minHeight: 14,
            color: props.deltaTone ?? "#7c8390",
            fontSize: 10,
            fontWeight: 800,
          }}
        >
          {props.delta ?? ""}
        </div>
      ) : null}
    </div>
  );
}

function PlaceholderCard() {
  return (
    <div
      style={{
        width: 184,
        minWidth: 184,
        borderRadius: 14,
        border: "1px dashed #24272b",
        background: "#0a0b0d",
        minHeight: 208,
      }}
    />
  );
}

function SlotCard({ slot, index }: { slot: PriceComparisonViewSlot; index: number }) {
  if (slot.empty) return <PlaceholderCard />;

  const priceDeltaRaw = deltaRatio(slot.current?.price ?? null, slot.previous?.price ?? null, true);
  const bsrDeltaRaw = deltaRatio(slot.current?.bsr ?? null, slot.previous?.bsr ?? null, true);
  const reviewDeltaRaw = deltaRatio(slot.current?.reviewCount ?? null, slot.previous?.reviewCount ?? null, false);
  const ratingDeltaRaw = deltaRatio(slot.current?.rating ?? null, slot.previous?.rating ?? null, false);

  const brandLabel = slot.brand ?? (index === 0 ? "BRAST" : "Konkurrenz");
  const detailText = slot.title ?? slot.asin ?? "";

  return (
    <div
      style={{
        width: 184,
        minWidth: 184,
        borderRadius: 14,
        border: `1px solid ${statusColor(slot)}`,
        background: "#0c0e10",
        padding: 10,
        minHeight: 208,
        display: "grid",
        gap: 8,
        overflow: "hidden",
        alignContent: "start",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: "#f4f7f6",
              fontSize: 17,
              fontWeight: 900,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {brandLabel}
          </div>
          <div
            style={{
              marginTop: 3,
              color: "#959ca5",
              fontSize: 10,
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {slot.asin ?? (slot.manual ? "Manuell" : "")}
          </div>
          {slot.amazonLink ? (
            <a
              href={slot.amazonLink}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                display: "inline-flex",
                marginTop: 5,
                color: VIOLET_TEXT,
                fontSize: 10,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Amazon ↗
            </a>
          ) : null}
        </div>
      </div>

      <div
        style={{
          color: "#b3bac2",
          fontSize: 11,
          lineHeight: 1.35,
          minHeight: 28,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
      >
        {detailText}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, minWidth: 0 }}>
        <MetricCell
          label="Preis"
          value={formatCurrency(metricValue(slot, "price"))}
          delta={deltaLabel(priceDeltaRaw)}
          deltaTone={deltaColor(priceDeltaRaw)}
        />
        <MetricCell
          label="BSR"
          value={formatNumber(metricValue(slot, "bsr"))}
          delta={deltaLabel(bsrDeltaRaw)}
          deltaTone={deltaColor(bsrDeltaRaw)}
        />
        <MetricCell
          label="Bewertungszahl"
          value={formatNumber(metricValue(slot, "reviewCount"))}
          delta={deltaLabel(reviewDeltaRaw)}
          deltaTone={deltaColor(reviewDeltaRaw)}
        />
        <MetricCell
          label="Bewertung"
          value={formatRating(metricValue(slot, "rating"))}
          delta={deltaLabel(ratingDeltaRaw)}
          deltaTone={deltaColor(ratingDeltaRaw)}
        />
      </div>

      <div
        style={{
          borderRadius: 10,
          border: "1px solid #202327",
          background: "#0f1113",
          padding: "7px 8px",
          minHeight: 42,
        }}
      >
        <div style={tinyLabelStyle()}>Kommentar</div>
        <div
          style={{
            marginTop: 3,
            color: "#f6f7f8",
            fontSize: 11,
            fontWeight: 800,
            lineHeight: 1.3,
            whiteSpace: "normal",
            overflowWrap: "anywhere",
          }}
        >
          {slot.comment ?? "–"}
        </div>
      </div>
    </div>
  );
}

function chartColors() {
  return [VIOLET, "#7bb4ff", "#d0b46d", "#d38eb2", "#9ea7ff", "#73c5c6", "#f1a38c"];
}

function getSeriesLabel(slot: PriceComparisonViewSlot, index: number) {
  return slot.brand ?? slot.asin ?? `Produkt ${index + 1}`;
}

function metricFromPoint(point: PriceComparisonViewSlot["history"][number], metric: ChartMetric) {
  return metric === "price" ? point.price : point.bsr;
}

function buildChartModel(row: PriceComparisonViewRow, metric: ChartMetric) {
  const labels = Array.from(new Set(row.slots.flatMap((slot) => slot.history.map((point) => point.snapshotDate)))).sort();
  const colors = chartColors();

  const series = row.slots
    .map((slot, index) => {
      const points = labels.map((date) => {
        const item = slot.history.find((point) => point.snapshotDate === date);
        return item ? metricFromPoint(item, metric) : null;
      });

      const hasAny = points.some((value) => typeof value === "number" && Number.isFinite(value));
      return hasAny ? { color: colors[index % colors.length], label: getSeriesLabel(slot, index), points } : null;
    })
    .filter((value): value is { color: string; label: string; points: Array<number | null> } => Boolean(value));

  const allValues = series.flatMap((entry) =>
    entry.points.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  );

  return {
    labels,
    series,
    min: allValues.length ? Math.min(...allValues) : null,
    max: allValues.length ? Math.max(...allValues) : null,
  };
}



function columnHeader(rows: Awaited<ReturnType<typeof loadPriceComparisonView>>["rows"], index: number) {
  for (const row of rows) {
    const slot = row.slots[index];
    if (!slot) continue;
    if (slot.brand) return slot.brand;
    if (slot.manualHint) return "Manuell";
  }
  return index === 0 ? "BRAST" : `Slot ${index + 1}`;
}

function snapshotMatchText(entry: { relevantMatchCount: number; totalItemCount: number }) {
  if (entry.relevantMatchCount > 0) return `${entry.relevantMatchCount} Treffer`;
  if (entry.totalItemCount > 0) return `0 relevante Treffer`;
  return "leer";
}

export default async function PriceComparisonPage({ searchParams }: Props) {
  const resolved = (await searchParams) ?? {};
  const categoryId = one(resolved.category);
  const snapshot = one(resolved.snapshot);
  const chartMetric = normalizeChartMetric(one(resolved.chart));
  const imported = one(resolved.imported);
  const legacyImported = one(resolved.legacyImported);
  const matched = one(resolved.matched);
  const ignored = one(resolved.ignored);
  const error = one(resolved.error);
  const defaultLegacyYear = new Date().getUTCFullYear();

  const view = await loadPriceComparisonView({
    categoryId,
    snapshotDate: snapshot,
  });

  const maxSlots = Math.max(1, ...view.rows.map((row) => row.slots.length));
  const columnHeaders = Array.from({ length: maxSlots }, (_, index) => columnHeader(view.rows, index));
  const gridTemplateColumns = `340px repeat(${maxSlots}, 184px)`;
  const downloadLabel = view.selectedSnapshotDate
    ? `Excel komplett herunterladen · ${formatSnapshotChipLabel(view.selectedSnapshotDate)}`
    : "Excel komplett herunterladen";

  return (
    <main style={{ minHeight: "100vh", background: "#070809", color: "#f5f6f7", padding: 24 }}>
      <div style={{ maxWidth: 1840, margin: "0 auto", display: "grid", gap: 18 }}>
        <section
          style={{
            borderRadius: 22,
            border: "1px solid #1d2024",
            background: "#0b0d0f",
            padding: 22,
            boxShadow: "0 24px 50px rgba(0,0,0,0.20)",
            display: "grid",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, letterSpacing: "-0.04em" }}>Preisvergleich</h1>
              <div style={{ marginTop: 6, color: "#9aa1a9", fontSize: 14 }}>
                CSV für neue Wochen, historische Excel nur zum einmaligen Rückwärts-Import alter Kalenderwochen.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a
                href={`/api/price-comparison/export${view.selectedSnapshotDate ? `?snapshot=${encodeURIComponent(view.selectedSnapshotDate)}` : ""}`}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${VIOLET_BORDER}`,
                  background: VIOLET_BG,
                  color: VIOLET_TEXT,
                  textDecoration: "none",
                  fontWeight: 900,
                  padding: "11px 14px",
                }}
              >
                {downloadLabel}
              </a>
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
                }}
              >
                Zur Toolbox
              </Link>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "start" }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ borderRadius: 16, border: "1px solid #1f2327", background: "#0d0f11", padding: 14 }}>
                <div style={tinyLabelStyle()}>CSV Upload</div>
                <form
                  action="/api/price-comparison/import"
                  method="post"
                  encType="multipart/form-data"
                  style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
                >
                  <input
                    type="file"
                    name="file"
                    accept=".csv,text/csv"
                    style={{
                      flex: "1 1 320px",
                      minWidth: 240,
                      borderRadius: 12,
                      border: "1px solid #2a2d31",
                      background: "#111315",
                      color: "#e4e4e7",
                      padding: 12,
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${VIOLET_BORDER}`,
                      background: VIOLET_BG,
                      color: VIOLET_TEXT,
                      fontWeight: 900,
                      padding: "12px 18px",
                      cursor: "pointer",
                    }}
                  >
                    CSV importieren
                  </button>
                </form>
                <div style={{ marginTop: 10, color: "#8d949d", fontSize: 12 }}>
                  
                </div>
              </div>

              <div style={{ borderRadius: 16, border: "1px solid #1f2327", background: "#0d0f11", padding: 14 }}>
                <div style={tinyLabelStyle()}>Historische Excel importieren</div>
                <form
                  action="/api/price-comparison/import-legacy"
                  method="post"
                  encType="multipart/form-data"
                  style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
                >
                  <input
                    type="file"
                    name="file"
                    accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    style={{
                      flex: "1 1 320px",
                      minWidth: 240,
                      borderRadius: 12,
                      border: "1px solid #2a2d31",
                      background: "#111315",
                      color: "#e4e4e7",
                      padding: 12,
                    }}
                  />
                  <input
                    type="number"
                    name="year"
                    defaultValue={defaultLegacyYear}
                    min={2020}
                    max={2100}
                    style={{
                      width: 120,
                      borderRadius: 12,
                      border: "1px solid #2a2d31",
                      background: "#111315",
                      color: "#e4e4e7",
                      padding: 12,
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${VIOLET_BORDER}`,
                      background: VIOLET_BG,
                      color: VIOLET_TEXT,
                      fontWeight: 900,
                      padding: "12px 18px",
                      cursor: "pointer",
                    }}
                  >
                    Historische Excel importieren
                  </button>
                </form>
                <div style={{ marginTop: 10, color: "#8d949d", fontSize: 12, lineHeight: 1.5 }}>
                  
                </div>
              </div>

              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid #1f2327",
                  background: "#0b0d10",
                  padding: 12,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={tinyLabelStyle()}>Wo finde ich die CSV?</div>
                <div style={{ color: "#d5dae0", fontSize: 13, lineHeight: 1.45 }}>
                  Lade die Datei unter <span style={{ color: VIOLET_TEXT, fontWeight: 800 }}>helium10.com/black-box/my-list</span> herunter.
                </div>
                <img
                  src="/price-comparison-black-box-download.png"
                  alt="Hinweis, wo die CSV in Helium 10 heruntergeladen wird"
                  style={{
                    display: "block",
                    width: "100%",
                    maxWidth: 760,
                    borderRadius: 12,
                    border: "1px solid #262a2f",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }} />
          </div>

          {error ? (
            <div
              style={{
                borderRadius: 14,
                border: "1px solid rgba(248,113,113,0.35)",
                background: "rgba(127,29,29,0.18)",
                padding: 12,
                color: "#fecaca",
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          ) : null}

          {legacyImported === "1" ? (
            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${VIOLET_BORDER}`,
                background: VIOLET_BG,
                padding: 12,
                color: VIOLET_TEXT,
                fontWeight: 700,
              }}
            >
              Historische Excel importiert · Treffer: {matched ?? "0"} · Ignoriert: {ignored ?? "0"}
            </div>
          ) : imported === "1" ? (
            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${VIOLET_BORDER}`,
                background: VIOLET_BG,
                padding: 12,
                color: VIOLET_TEXT,
                fontWeight: 700,
              }}
            >
              CSV importiert · Treffer: {matched ?? "0"} · Ignoriert: {ignored ?? "0"}
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 8 }}>
            <div style={tinyLabelStyle()}>Kategorien</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {view.categories.map((category) => {
                const active = category.id === view.selectedCategory?.id;
                return (
                  <a
                    key={category.id}
                    href={buildHref({ category: category.id, snapshot: view.selectedSnapshotDate, chart: chartMetric })}
                    style={{
                      borderRadius: 999,
                      border: active ? `1px solid ${VIOLET_BORDER}` : "1px solid #272a2f",
                      background: active ? VIOLET_BG : "#101214",
                      color: active ? VIOLET_TEXT : "#e5e7eb",
                      textDecoration: "none",
                      fontWeight: 800,
                      padding: "9px 14px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {category.label}
                  </a>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={tinyLabelStyle()}>Snapshots</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {view.snapshotOptions.length === 0 ? (
                <div style={{ color: "#8d949d", fontSize: 13 }}>Noch keine CSV importiert.</div>
              ) : (
                view.snapshotOptions.map((entry) => {
                  const active = entry.snapshotDate === view.selectedSnapshotDate;
                  const chipLabel = `${formatSnapshotChipLabel(entry.snapshotDate)} · ${snapshotMatchText(entry)}`;
                  return (
                    <div key={entry.id} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <a
                        href={buildHref({ category: view.selectedCategory?.id ?? null, snapshot: entry.snapshotDate, chart: chartMetric })}
                        title={`${entry.sourceFilename} · ${snapshotMatchText(entry)}`}
                        style={{
                          borderRadius: 999,
                          border: active ? `1px solid ${VIOLET_BORDER}` : "1px solid #272a2f",
                          background: active ? VIOLET_BG : "#101214",
                          color: active ? VIOLET_TEXT : "#e5e7eb",
                          textDecoration: "none",
                          fontWeight: 800,
                          padding: "9px 14px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {chipLabel}
                      </a>
                      <DeleteSnapshotButton snapshotId={entry.id} snapshotLabel={formatSnapshotChipLabel(entry.snapshotDate)} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section
          style={{
            borderRadius: 22,
            border: "1px solid #1d2024",
            background: "#0b0d0f",
            padding: 14,
            boxShadow: "0 24px 50px rgba(0,0,0,0.18)",
            overflowX: "auto",
          }}
        >
          <div style={{ minWidth: `calc(340px + ${maxSlots} * 184px)` }}>
            <div style={{ display: "grid", gridTemplateColumns, gap: 10, marginBottom: 10 }}>
              <div
                style={{
                  position: "sticky",
                  left: 0,
                  zIndex: 4,
                  borderRadius: 14,
                  border: "1px solid #1d2024",
                  background: "#0e1012",
                  minHeight: 42,
                }}
              />
              {columnHeaders.map((header, index) => (
                <div
                  key={`${header}-${index}`}
                  style={{
                    borderRadius: 14,
                    border: "1px solid #1d2024",
                    background: "#0e1012",
                    padding: "9px 10px",
                    color: "#eef1f2",
                    fontSize: 13,
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {header}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {view.rows.map((row, rowIndex) => (
                <div
                  key={`${row.itemNumber ?? rowIndex}-${row.label}`}
                  style={{ display: "grid", gridTemplateColumns, gap: 10, alignItems: "start" }}
                >
                  <div
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 3,
                      borderRadius: 16,
                      border: "1px solid #1f2327",
                      background: "#0d0f11",
                      padding: 12,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div>
                      {row.itemNumber ? (
                        <div style={{ color: "#8d949d", fontSize: 11, fontWeight: 800 }}>{row.itemNumber}</div>
                      ) : null}
                      <div style={{ marginTop: 4, color: "#f6f7f8", fontSize: 15, fontWeight: 900, lineHeight: 1.25 }}>
                        {row.label}
                      </div>
                    </div>

                    <RowChartClient
                      row={{
                        slots: row.slots.map((slot) => ({
                          brand: slot.brand,
                          asin: slot.asin,
                          history: slot.history,
                        })),
                      }}
                      metric={chartMetric}
                      selectedCategoryId={view.selectedCategory?.id ?? null}
                      selectedSnapshotDate={view.selectedSnapshotDate}
                    />
                  </div>

                  {Array.from({ length: maxSlots }, (_, index) => {
                    const slot = row.slots[index];
                    return slot ? <SlotCard key={index} slot={slot} index={index} /> : <PlaceholderCard key={index} />;
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
