"use client";

import { useMemo, useState, useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type ScopeTreeNode = {
  key: string;
  label: string;
  scopeLevel: 1 | 2 | 3;
  scopeId: string;
  revenueSum: number | null;
  salesSum: number | null;
  parentProductsCount: number;
  minProductRevenue: number | null;
  children: ScopeTreeNode[];
};

type Props = {
  month: string;
  monthOptions: string[];
  roots: ScopeTreeNode[];
  initialIncludeKeys: string[];
  initialExcludeKeys: string[];
  hideDuplicateProducts: boolean;
};

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

function compact(list: string[]) {
  return Array.from(new Set(list.filter(Boolean)));
}

function formatMonthLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [year, monthPart] = month.split("-");
  return `${monthPart}.${year}`;
}

export default function CategoryScopeTreeFilter({
  month,
  monthOptions,
  roots,
  initialIncludeKeys,
  initialExcludeKeys,
  hideDuplicateProducts,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [selectedMonth, setSelectedMonth] = useState(month);
  const [includeKeys, setIncludeKeys] = useState<string[]>(initialIncludeKeys);
  const [excludeKeys, setExcludeKeys] = useState<string[]>(initialExcludeKeys);
  const [hideDuplicateProductsDraft, setHideDuplicateProductsDraft] = useState(hideDuplicateProducts);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    setSelectedMonth(month);
  }, [month]);

  useEffect(() => {
    setIncludeKeys(initialIncludeKeys);
    setExcludeKeys(initialExcludeKeys);
  }, [initialIncludeKeys, initialExcludeKeys]);

  useEffect(() => {
    setHideDuplicateProductsDraft(hideDuplicateProducts);
  }, [hideDuplicateProducts]);

  const treeIndex = useMemo(() => {
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

      descendantsByKey.set(node.key, compact(descendants));
      subtreeByKey.set(node.key, compact(subtree));
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

    return {
      nodeByKey,
      parentByKey,
      descendantsByKey,
      subtreeByKey,
      getAncestors,
    };
  }, [roots]);

  function isSelected(key: string) {
    const included = includeKeys.includes(key) || treeIndex.getAncestors(key).some((ancestor) => includeKeys.includes(ancestor));
    const excluded = excludeKeys.includes(key) || treeIndex.getAncestors(key).some((ancestor) => excludeKeys.includes(ancestor));
    return included && !excluded;
  }

  function getSelectionState(node: ScopeTreeNode): "checked" | "partial" | "unchecked" {
    const subtree = treeIndex.subtreeByKey.get(node.key) ?? [node.key];
    const selectedCount = subtree.filter((key) => isSelected(key)).length;
    if (selectedCount === 0) return "unchecked";
    if (selectedCount === subtree.length) return "checked";
    return "partial";
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key]
    );
  }

  function toggleChecked(node: ScopeTreeNode) {
    const state = getSelectionState(node);
    const descendants = treeIndex.descendantsByKey.get(node.key) ?? [];
    const ancestors = treeIndex.getAncestors(node.key);

    if (state === "checked" || state === "partial") {
      setIncludeKeys((current) => current.filter((key) => key !== node.key && !descendants.includes(key)));
      setExcludeKeys((current) => compact([...current.filter((key) => !descendants.includes(key)), node.key]));
      return;
    }

    setIncludeKeys((current) => compact([...current.filter((key) => !descendants.includes(key)), node.key]));
    setExcludeKeys((current) => current.filter((key) => key !== node.key && !descendants.includes(key) && !ancestors.includes(key)));
  }

  function resetToDefault() {
    const firstRoot = roots[0]?.key;
    setIncludeKeys(firstRoot ? [firstRoot] : []);
    setExcludeKeys([]);
    setExpandedKeys([]);
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", selectedMonth);

    const include = compact(includeKeys);
    const exclude = compact(excludeKeys);

    if (include.length > 0) params.set("include", include.join(","));
    else params.delete("include");

    if (exclude.length > 0) params.set("exclude", exclude.join(","));
    else params.delete("exclude");

    if (hideDuplicateProductsDraft) params.delete("hideDuplicateProducts");
    else params.set("hideDuplicateProducts", "0");

    startTransition(() => {
      router.push(`/category-analysis?${params.toString()}`);
    });
  }

  const explicitSelectionPreview = useMemo(() => {
    return compact(includeKeys)
      .map((key) => treeIndex.nodeByKey.get(key)?.label ?? key)
      .sort((a, b) => a.localeCompare(b, "de"));
  }, [includeKeys, treeIndex.nodeByKey]);

  const explicitExclusionPreview = useMemo(() => {
    return compact(excludeKeys)
      .map((key) => treeIndex.nodeByKey.get(key)?.label ?? key)
      .sort((a, b) => a.localeCompare(b, "de"));
  }, [excludeKeys, treeIndex.nodeByKey]);

  const includePreview = explicitSelectionPreview.slice(0, 4);
  const excludePreview = explicitExclusionPreview.slice(0, 4);
  const includeOverflow = Math.max(0, explicitSelectionPreview.length - includePreview.length);
  const excludeOverflow = Math.max(0, explicitExclusionPreview.length - excludePreview.length);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {isPending ? (
        <div
          style={{
            position: "fixed",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 120,
            width: "min(420px, calc(100vw - 32px))",
            borderRadius: 18,
            border: "1px solid rgba(96,165,250,0.28)",
            background: "rgba(8, 12, 20, 0.94)",
            boxShadow: "0 18px 40px rgba(0,0,0,0.42)",
            backdropFilter: "blur(12px)",
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#e5f0ff",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "999px",
                border: "2px solid rgba(255,255,255,0.18)",
                borderTopColor: "#60a5fa",
                animation: "caFilterSpin 0.8s linear infinite",
                flex: "0 0 auto",
              }}
            />
            <span>Filter werden angewendet ...</span>
          </div>

          <div
            style={{
              marginTop: 10,
              height: 4,
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "38%",
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)",
                animation: "caFilterLoad 1.1s ease-in-out infinite",
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="caScopeLayout">
        <div
          className="caScopeMain"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 22,
            overflow: "hidden",
            background: "linear-gradient(180deg, rgba(12,12,12,0.96) 0%, rgba(7,7,7,0.98) 100%)",
            boxShadow: "0 22px 48px rgba(0,0,0,0.28)",
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "linear-gradient(135deg, rgba(59,130,246,0.16) 0%, rgba(56,189,248,0.10) 35%, rgba(255,255,255,0.02) 100%)",
              display: "grid",
              gap: 8,
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
              Kategorieauswahl
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#f8fafc" }}>Kategoriebaum</div>
                <div style={{ marginTop: 4, color: "#cbd5e1", fontSize: 13 }}>
                  1x klicken = ganzer Ast an. Erneut klicken = ausschliessen. Die Baumlogik bleibt unveraendert.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <MiniPill label="Aktiv an" value={num(compact(includeKeys).length)} tone="green" />
                <MiniPill label="Aktiv aus" value={num(compact(excludeKeys).length)} tone="red" />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", maxHeight: 620, overflow: "auto" }}>
            {roots.map((root) => (
              <TreeRow
                key={root.key}
                node={root}
                depth={0}
                expandedKeys={expandedKeys}
                onToggleExpanded={toggleExpanded}
                onToggleChecked={toggleChecked}
                getSelectionState={getSelectionState}
              />
            ))}
          </div>
        </div>

        <div
          className="caScopeSide"
          style={{
            display: "grid",
            gap: 12,
            minWidth: 0,
          }}
        >
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 22,
              background: "linear-gradient(180deg, rgba(12,12,12,0.98) 0%, rgba(7,7,7,0.98) 100%)",
              boxShadow: "0 22px 48px rgba(0,0,0,0.28)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 900, color: "#f8fafc" }}>Filter anwenden</div>
              <div style={{ marginTop: 4, color: "#a1a1aa", fontSize: 12 }}>
                Monat waehlen, Auswahl pruefen und dann direkt uebernehmen.
              </div>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <ContextStatCard label="Monat" value={formatMonthLabel(selectedMonth)} />
                <ContextStatCard label="Status" value={isPending ? "Laedt" : "Bereit"} />
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <CompactSummary title="Explizit an" items={includePreview} overflowCount={includeOverflow} tone="green" />
                <CompactSummary title="Explizit aus" items={excludePreview} overflowCount={excludeOverflow} tone="red" />
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#d4d4d8", fontWeight: 800 }}>Monat</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  disabled={isPending}
                  style={{
                    width: "100%",
                    height: 44,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.09)",
                    background: "rgba(255,255,255,0.03)",
                    color: "#f3f4f6",
                    padding: "0 12px",
                    cursor: isPending ? "wait" : "pointer",
                    opacity: isPending ? 0.7 : 1,
                  }}
                >
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              



              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  border: "1px solid rgba(245,158,11,0.28)",
                  background: "rgba(245,158,11,0.08)",
                  borderRadius: 16,
                  padding: "12px 14px",
                  cursor: "pointer",
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", color: "#f8fafc", fontSize: 13, fontWeight: 900 }}>
                    Doppelte Produkte Ausblenden
                  </span>
                  <span style={{ display: "block", marginTop: 3, color: "#a1a1aa", fontSize: 11 }}>
                    Wird erst mit „Anwenden“ übernommen.
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={hideDuplicateProductsDraft}
                  onChange={(e) => setHideDuplicateProductsDraft(e.target.checked)}
                  style={{ width: 20, height: 20, cursor: "pointer", flex: "0 0 auto" }}
                />
              </label>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <button
                  type="button"
                  onClick={resetToDefault}
                  disabled={isPending}
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.09)",
                    background: "rgba(255,255,255,0.03)",
                    color: "#f3f4f6",
                    fontWeight: 800,
                    padding: "10px 14px",
                    cursor: isPending ? "wait" : "pointer",
                    minHeight: 44,
                    opacity: isPending ? 0.6 : 1,
                  }}
                >
                  Reset
                </button>

                <button
                  type="button"
                  onClick={applyFilters}
                  disabled={isPending}
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(125,211,252,0.22)",
                    background: "linear-gradient(135deg, rgba(59,130,246,0.92) 0%, rgba(14,165,233,0.92) 100%)",
                    color: "white",
                    fontWeight: 900,
                    padding: "10px 14px",
                    cursor: isPending ? "wait" : "pointer",
                    minHeight: 44,
                    opacity: isPending ? 0.7 : 1,
                    boxShadow: "0 14px 28px rgba(37,99,235,0.24)",
                  }}
                >
                  {isPending ? "Laedt ..." : "Anwenden"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          border: "1px solid #1a1a1a",
          borderRadius: 18,
          background: "#050505",
          padding: 14,
        }}
      >
        <div>
          <div style={{ color: "#f5f5f5", fontWeight: 900 }}>Doppelte Produkte Ausblenden</div>
          <div style={{ marginTop: 4, color: "#8b8b8b", fontSize: 12 }}>
            Wird erst mit "Anwenden" übernommen. Standard: an.
          </div>
        </div>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            color: "#e5e7eb",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          <input
            type="checkbox"
            checked={hideDuplicateProductsDraft}
            onChange={(e) => setHideDuplicateProductsDraft(e.target.checked)}
            style={{ width: 18, height: 18, cursor: "pointer" }}
          />
          An
        </label>
      </div>

      <style>{`
        @keyframes caFilterSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes caFilterLoad {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(320%);
          }
        }

        .caScopeLayout {
          display: grid;
          gap: 12px;
          grid-template-columns: minmax(0, 1fr);
        }

        @media (min-width: 1080px) {
          .caScopeLayout {
            grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
            align-items: start;
          }

          .caScopeSide {
            position: sticky;
            top: 12px;
          }
        }
      `}</style>
    </div>
  );
}

type TreeRowProps = {
  node: ScopeTreeNode;
  depth: number;
  expandedKeys: string[];
  onToggleExpanded: (key: string) => void;
  onToggleChecked: (node: ScopeTreeNode) => void;
  getSelectionState: (node: ScopeTreeNode) => "checked" | "partial" | "unchecked";
};

function TreeRow({
  node,
  depth,
  expandedKeys,
  onToggleExpanded,
  onToggleChecked,
  getSelectionState,
}: TreeRowProps) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedKeys.includes(node.key);
  const selectionState = getSelectionState(node);
  const checkboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = selectionState === "partial";
    }
  }, [selectionState]);

  const statusPalette =
    selectionState === "checked"
      ? { border: "#14532d", bg: "rgba(34,197,94,0.08)", text: "#86efac", label: "aktiv" }
      : selectionState === "partial"
        ? { border: "#374151", bg: "rgba(255,255,255,0.05)", text: "#e5e7eb", label: "teilweise" }
        : { border: "#262626", bg: "#090909", text: "#6b7280", label: "aus" };

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto minmax(0,1fr) auto",
          gap: 9,
          alignItems: "center",
          padding: "9px 12px",
          borderBottom: "1px solid #111111",
          background:
            selectionState === "checked"
              ? "rgba(255,255,255,0.03)"
              : selectionState === "partial"
                ? "rgba(255,255,255,0.02)"
                : "transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleExpanded(node.key)}
              aria-label={expanded ? "zuklappen" : "aufklappen"}
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                border: "1px solid #242424",
                background: "#101010",
                color: "#f3f4f6",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              {expanded ? "⌃" : "⌄"}
            </button>
          ) : (
            <div style={{ width: 26 }} />
          )}

          <input
            ref={checkboxRef}
            type="checkbox"
            checked={selectionState === "checked"}
            onChange={() => onToggleChecked(node)}
            style={{ width: 18, height: 18, cursor: "pointer" }}
          />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 800, color: "#f9fafb", minWidth: 0 }}>{node.label}</div>
            <span style={{ padding: "3px 7px", borderRadius: 999, border: "1px solid #262626", background: "#101010", color: "#a3a3a3", fontSize: 11, fontWeight: 800 }}>
              O{node.scopeLevel}
            </span>
          </div>
          <div style={{ marginTop: 5, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <MetricTag label="Umsatz" value={eur(node.revenueSum)} />
            <MetricTag label="Parents" value={num(node.parentProductsCount)} />
            <MetricTag label="Min Produkt-Umsatz" value={eur(node.minProductRevenue)} />
          </div>
        </div>

        <div style={{ minWidth: 88, textAlign: "right" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 80,
              padding: "7px 10px",
              borderRadius: 999,
              border: `1px solid ${statusPalette.border}`,
              background: statusPalette.bg,
              color: statusPalette.text,
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {statusPalette.label}
          </span>
        </div>
      </div>

      {expanded && hasChildren ? (
        <div style={{ borderLeft: "1px solid #141414", marginLeft: 20 }}>
          {node.children.map((child) => (
            <TreeRow
              key={child.key}
              node={child}
              depth={depth + 1}
              expandedKeys={expandedKeys}
              onToggleExpanded={onToggleExpanded}
              onToggleChecked={onToggleChecked}
              getSelectionState={getSelectionState}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MetricTag({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        border: "1px solid #1f1f1f",
        background: "#0d0d0d",
        padding: "4px 8px",
        fontSize: 11,
        color: "#d4d4d8",
      }}
    >
      <span style={{ color: "#7a7a7a", fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 800 }}>{value}</span>
    </span>
  );
}

function MiniPill({ label, value, tone }: { label: string; value: string; tone: "default" | "red" | "green" }) {
  const palette = tone === "red"
    ? { border: "#7f1d1d", bg: "rgba(239,68,68,0.08)", text: "#fecaca", dim: "#fca5a5" }
    : tone === "green"
      ? { border: "#14532d", bg: "rgba(34,197,94,0.08)", text: "#dcfce7", dim: "#86efac" }
      : { border: "#262626", bg: "#0d0d0d", text: "#f5f5f5", dim: "#8b8b8b" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        padding: "8px 10px",
        fontSize: 12,
      }}
    >
      <span style={{ color: palette.dim, fontWeight: 800 }}>{label}</span>
      <span style={{ color: palette.text, fontWeight: 900 }}>{value}</span>
    </span>
  );
}

type CompactSummaryProps = {
  title: string;
  items: string[];
  overflowCount?: number;
  tone: "green" | "red";
};

function CompactSummary({ title, items, overflowCount = 0, tone }: CompactSummaryProps) {
  const palette =
    tone === "green"
      ? {
          border: "#14532d",
          bg: "rgba(34,197,94,0.08)",
          text: "#dcfce7",
          dim: "#9ca3af",
        }
      : {
          border: "#7f1d1d",
          bg: "rgba(239,68,68,0.08)",
          text: "#fee2e2",
          dim: "#9ca3af",
        };

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        border: `1px solid ${palette.border}`,
        borderRadius: 18,
        background: palette.bg,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontWeight: 800, color: palette.text, fontSize: 12 }}>{title}</div>
      {items.length === 0 ? (
        <span style={{ color: palette.dim, fontSize: 12 }}>-</span>
      ) : (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {items.map((item) => (
            <span
              key={item}
              style={{
                borderRadius: 999,
                border: `1px solid ${palette.border}`,
                padding: "5px 8px",
                color: palette.text,
                fontSize: 11,
                fontWeight: 700,
                background: "rgba(0,0,0,0.18)",
              }}
            >
              {item}
            </span>
          ))}
          {overflowCount > 0 ? (
            <span
              style={{
                borderRadius: 999,
                border: `1px solid ${palette.border}`,
                padding: "5px 8px",
                color: palette.dim,
                fontSize: 11,
                fontWeight: 700,
                background: "rgba(0,0,0,0.18)",
              }}
            >
              +{overflowCount} weitere
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ContextStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.03)",
        padding: "10px 12px",
      }}
    >
      <div style={{ color: "#71717a", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {label}
      </div>
      <div style={{ marginTop: 4, color: "#f8fafc", fontSize: 14, fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}
