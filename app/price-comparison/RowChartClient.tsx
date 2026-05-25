"use client";

import { useMemo, useState } from "react";

type ChartMetric = "price" | "bsr";

type HistoryPoint = {
  snapshotDate: string;
  price: number | null;
  bsr: number | null;
  reviewCount: number | null;
  rating: number | null;
  asinRevenue: number | null;
};

type Slot = {
  brand: string | null;
  asin: string | null;
  history: HistoryPoint[];
};

type Row = {
  slots: Slot[];
};

function buildHref(input: {
  category?: string | null;
  snapshot?: string | null;
  chart?: ChartMetric;
}) {
  const params = new URLSearchParams();
  if (input.category) params.set("category", input.category);
  if (input.snapshot) params.set("snapshot", input.snapshot);
  if (input.chart) params.set("chart", input.chart);
  const query = params.toString();
  return query ? `/price-comparison?${query}` : "/price-comparison";
}

function formatSnapshotChipLabel(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "–";
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `KW ${week}`;
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

function chartColors() {
  return ["#a78bfa", "#7bb4ff", "#d0b46d", "#d38eb2", "#9ea7ff", "#73c5c6", "#f1a38c"];
}

function getSeriesLabel(slot: Slot, index: number) {
  return slot.brand ?? slot.asin ?? `Produkt ${index + 1}`;
}

function metricFromPoint(point: HistoryPoint, metric: ChartMetric) {
  return metric === "price" ? point.price : point.bsr;
}

function buildChartModel(row: Row, metric: ChartMetric) {
  const labels = Array.from(
    new Set(row.slots.flatMap((slot) => slot.history.map((point) => point.snapshotDate)))
  ).sort();

  const colors = chartColors();

  const series = row.slots
    .map((slot, index) => {
      const points = labels.map((date) => {
        const item = slot.history.find((point) => point.snapshotDate === date);
        return item ? metricFromPoint(item, metric) : null;
      });

      const hasAny = points.some((value) => typeof value === "number" && Number.isFinite(value));

      return hasAny
        ? {
            color: colors[index % colors.length],
            label: getSeriesLabel(slot, index),
            points,
          }
        : null;
    })
    .filter(
      (value): value is { color: string; label: string; points: Array<number | null> } => Boolean(value)
    );

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

export default function RowChartClient({
  row,
  metric,
  selectedCategoryId,
  selectedSnapshotDate,
}: {
  row: Row;
  metric: ChartMetric;
  selectedCategoryId: string | null;
  selectedSnapshotDate: string | null;
}) {
  const model = useMemo(() => buildChartModel(row, metric), [row, metric]);
  const [hovered, setHovered] = useState<null | {
    x: number;
    y: number;
    color: string;
    label: string;
    snapshotDate: string;
    value: number;
  }>(null);

  if (model.labels.length < 2 || model.series.length === 0 || model.min == null || model.max == null) {
    return (
      <div
        style={{
          borderRadius: 14,
          border: "1px solid #202327",
          background: "#0d0f11",
          padding: 12,
          color: "#8b9098",
          fontSize: 12,
        }}
      >
        Noch keine ausreichende Historie für den Verlauf.
      </div>
    );
  }

  const width = 300;
  const height = 108;
  const padding = { top: 10, right: 8, bottom: 22, left: 8 };
  const drawableWidth = width - padding.left - padding.right;
  const drawableHeight = height - padding.top - padding.bottom;
  const xStep = model.labels.length > 1 ? drawableWidth / (model.labels.length - 1) : drawableWidth;
  const yMin = model.min;
  const yMax = model.max === model.min ? model.max + 1 : model.max;

  const yFor = (value: number) => {
    const normalized = (value - yMin) / (yMax - yMin);
    return padding.top + drawableHeight - normalized * drawableHeight;
  };

  const xFor = (index: number) => padding.left + index * xStep;
  const lines = [0.25, 0.5, 0.75].map((fraction) => padding.top + drawableHeight * fraction);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["price", "bsr"] as ChartMetric[]).map((entry) => {
          const active = entry === metric;
          return (
            <a
              key={entry}
              href={buildHref({
                category: selectedCategoryId,
                snapshot: selectedSnapshotDate,
                chart: entry,
              })}
              style={{
                borderRadius: 999,
                border: active ? "1px solid rgba(167,139,250,0.40)" : "1px solid #262a2e",
                background: active ? "rgba(167,139,250,0.12)" : "#111315",
                color: active ? "#efe7ff" : "#d3d6da",
                textDecoration: "none",
                fontSize: 11,
                fontWeight: 800,
                padding: "6px 10px",
              }}
            >
              {entry === "price" ? "Preis" : "BSR"}
            </a>
          );
        })}
      </div>

      <div
        style={{
          position: "relative",
          borderRadius: 14,
          border: "1px solid #202327",
          background: "#0d0f11",
          padding: 10,
        }}
      >
        {hovered ? (
          <div
            style={{
              position: "absolute",
              left: Math.min(Math.max(hovered.x - 48, 8), width - 120),
              top: Math.max(hovered.y - 56, 6),
              zIndex: 5,
              pointerEvents: "none",
              borderRadius: 10,
              border: "1px solid #2b2f34",
              background: "rgba(8,10,12,0.96)",
              padding: "8px 10px",
              minWidth: 110,
              boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: hovered.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: "#f5f6f7",
                  fontSize: 11,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                {hovered.label}
              </span>
            </div>
            <div style={{ marginTop: 4, color: "#9aa1a9", fontSize: 10, fontWeight: 700 }}>
              {formatSnapshotChipLabel(hovered.snapshotDate)}
            </div>
            <div style={{ marginTop: 4, color: "#f5f6f7", fontSize: 12, fontWeight: 900 }}>
              {metric === "price" ? formatCurrency(hovered.value) : formatNumber(hovered.value)}
            </div>
          </div>
        ) : null}

        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          style={{ display: "block" }}
          onMouseLeave={() => setHovered(null)}
        >
          {lines.map((line, index) => (
            <line
              key={index}
              x1={padding.left}
              y1={line}
              x2={width - padding.right}
              y2={line}
              stroke="#1b1f22"
              strokeWidth="1"
            />
          ))}

          {model.series.map((entry) => {
            const coordinates = entry.points
              .map((value, index) => {
                if (typeof value !== "number" || !Number.isFinite(value)) return null;
                return `${xFor(index)},${yFor(value)}`;
              })
              .filter((value): value is string => Boolean(value));

            return coordinates.length >= 2 ? (
              <polyline
                key={entry.label}
                fill="none"
                stroke={entry.color}
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={coordinates.join(" ")}
              />
            ) : null;
          })}

          {model.series.flatMap((entry) =>
            entry.points.map((value, index) => {
              if (typeof value !== "number" || !Number.isFinite(value)) return null;

              const cx = xFor(index);
              const cy = yFor(value);

              return (
                <circle
                    key={`${entry.label}-${index}`}
                    cx={cx}
                    cy={cy}
                    r="4.5"
                    fill={entry.color}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() =>
                        setHovered({
                        x: cx,
                        y: cy,
                        color: entry.color,
                        label: entry.label,
                        snapshotDate: model.labels[index],
                        value,
                        })
                    }
                    onMouseLeave={() => setHovered(null)}
                    />
              );
            })
          )}

          {model.labels.map((label, index) => (
            <text
              key={label}
              x={xFor(index)}
              y={height - 6}
              fill="#7f8790"
              fontSize="9"
              textAnchor={index === 0 ? "start" : index === model.labels.length - 1 ? "end" : "middle"}
            >
              {formatSnapshotChipLabel(label).replace(/^KW\s*/i, "")}
            </text>
          ))}
        </svg>

        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {model.series.map((entry) => (
            <div key={entry.label} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: entry.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: "#cdd2d7",
                  fontSize: 11,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 115,
                }}
              >
                {entry.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}