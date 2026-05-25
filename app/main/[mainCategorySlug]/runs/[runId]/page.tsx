export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RunPipelineButton from "@/components/RunPipelineButton";
import ActiveBatchSelector from "./ActiveBatchSelector";
import RunContextNav from "@/components/RunContextNav";

type Props = {
  params: Promise<{ mainCategorySlug: string; runId: string }>;
};

export default async function RunDetailPage({ params }: Props) {
  const { mainCategorySlug, runId } = await params;

  const run = await prisma.importRun.findUnique({
    where: { id: runId },
    include: {
      mainCategory: true,
      category2Links: {
        include: { category2: true },
        orderBy: { category2: { name: "asc" } },
      },
    },
  });
  if (!run) notFound();
  if (run.mainCategory.slug !== mainCategorySlug) notFound();

  // ✅ Vergleich kommt jetzt aus der DB (run.compareToRunId)
  const compareRun = run.compareToRunId
    ? await prisma.importRun.findUnique({
        where: { id: run.compareToRunId },
        select: { id: true, month: true },
      })
    : null;

  const compareMonth =
    compareRun?.month && /^\d{4}-\d{2}$/.test(compareRun.month) ? compareRun.month : null;

  // Links (Rollups/Sanity) bekommen compareMonth als Query
  const compareQ = compareMonth ? `?compareMonth=${encodeURIComponent(compareMonth)}` : "";

  // Kandidaten pro Category2: Batches dieses Monats
  const category2Ids = run.category2Links.map((x) => x.category2Id);

  const batches = await prisma.importBatch.findMany({
    where: { month: run.month, category2Id: { in: category2Ids } },
    orderBy: { createdAt: "desc" },
    select: { id: true, category2Id: true, createdAt: true, status: true },
  });

  const rollupCounts = await prisma.aggParentProductMonth.groupBy({
    by: ["category2Id"],
    where: { month: run.month, category2Id: { in: category2Ids } },
    _count: { _all: true },
    _max: { updatedAt: true },
  });

  const rollupByC2 = new Map(
    rollupCounts.map((x) => [
      x.category2Id,
      { parents: x._count._all, updatedAt: x._max.updatedAt },
    ])
  );

  const batchesByC2 = new Map<string, typeof batches>();
  for (const b of batches) {
    const arr = batchesByC2.get(b.category2Id) ?? [];
    arr.push(b);
    batchesByC2.set(b.category2Id, arr);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0b", color: "#f5f5f5", minHeight: "100vh" }}>
      <Link href={`/main/${mainCategorySlug}/runs`} style={{ color: "#fff", textDecoration: "underline" }}>
        ← zurück zu Runs
      </Link>

      <h1 style={{ marginTop: 12, fontSize: 22, fontWeight: 900 }}>
        Monatslauf {run.month} · {run.mainCategory.name}
      </h1>

      <p style={{ color: "#bdbdbd", marginTop: 6 }}>
        Vergleich:{" "}
        {compareMonth ? (
          <>
            <b style={{ color: "#fff" }}>{compareMonth}</b>{" "}
            <span style={{ color: "#9a9a9a" }}>({compareRun?.id.slice(0, 8)}…)</span>
          </>
        ) : (
          <span>kein</span>
        )}
        {" · "}
        <Link href={`/main/${mainCategorySlug}/runs`} style={{ color: "#fff", textDecoration: "underline" }}>
          auf /runs ändern
        </Link>
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {run.category2Links.map((rc) => {
          const c2 = rc.category2;
          const candidates = batchesByC2.get(c2.id) ?? [];
          const active = rc.activeBatchId;
          const activeBatch = active ? candidates.find((x) => x.id === active) : null;
          const roll = rollupByC2.get(c2.id) ?? null;

          return (
            <div key={rc.id} style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{c2.name}</div>
                  <div style={{ color: "#bdbdbd", fontSize: 13 }}>
                    Status: {rc.status} · Required: {rc.isRequired ? "yes" : "no"}
                  </div>
                </div>

                <div style={{ marginTop: 6, color: "#bdbdbd", fontSize: 13 }}>
                  Active Batch:{" "}
                  {activeBatch ? (
                    <>
                      <b style={{ color: "#fff" }}>{activeBatch.id.slice(0, 8)}…</b> · {activeBatch.status} ·{" "}
                      {new Date(activeBatch.createdAt).toLocaleString("de-DE")}
                    </>
                  ) : (
                    "–"
                  )}
                  <br />
                  Rollups:{" "}
                  {roll ? (
                    <>
                      ✅ <b style={{ color: "#fff" }}>{roll.parents}</b> Parents
                      {roll.updatedAt ? ` · updated ${new Date(roll.updatedAt).toLocaleString("de-DE")}` : ""}
                    </>
                  ) : (
                    "❌ keine"
                  )}
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <RunContextNav
                      href={`/category-overview/${c2.id}`}
                      label="Category2 öffnen"
                      runId={run.id}
                      mainCategorySlug={mainCategorySlug}
                      category2Id={c2.id}
                    />
                    <RunContextNav
                      href={`/category-overview/${c2.id}`}
                      label="Neu hochladen"
                      runId={run.id}
                      mainCategorySlug={mainCategorySlug}
                      category2Id={c2.id}
                    />
                  </div>

                  {active ? (
                    <>
                      <Link href={`/imports/${active}`} style={{ color: "#fff", textDecoration: "underline" }}>
                        Active Import
                      </Link>
                      <Link href={`/rollups/${run.month}/${c2.id}${compareQ}`} style={{ color: "#fff", textDecoration: "underline" }}>
                        Rollups
                      </Link>
                      <Link
                        href={`/rollups/${run.month}/${c2.id}/sanity${compareQ}`}
                        style={{ color: "#fff", textDecoration: "underline" }}
                      >
                        Sanity
                      </Link>
                    </>
                  ) : (
                    <span style={{ color: "#bdbdbd" }}>kein aktiver Batch</span>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <ActiveBatchSelector
                  runId={run.id}
                  category2Id={c2.id}
                  activeBatchId={active ?? ""}
                  candidates={candidates.map((b) => ({
                    id: b.id,
                    status: b.status,
                    createdAt: b.createdAt.toISOString(),
                  }))}
                />
              </div>

              {active ? <RunPipelineButton batchId={active} /> : null}
            </div>
          );
        })}
      </div>
    </main>
  );
}