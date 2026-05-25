export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AddLeafForm from "./AddLeafForm";
import RecomputeLatestRunButton from "./RecomputeLatestRunButton";

export default async function EditTreePage({
  params,
}: {
  params: Promise<{ mainCategorySlug: string }>;
}) {
  const { mainCategorySlug } = await params;

  const main = await prisma.mainCategory.findUnique({
    where: { slug: mainCategorySlug },
    include: { category2: { orderBy: { name: "asc" } } },
  });
  if (!main) notFound();

  const category2Options = main.category2.map((c) => ({ id: c.id, name: c.name }));
  const category2Ids = category2Options.map((c) => c.id);

    // Parent-Auswahl: alle Nodes je Category2 (damit du Parent/Ordner auswählen kannst)
    const allNodes = await prisma.categoryNode.findMany({
      where: { category2Id: { in: category2Ids } },
      select: { category2Id: true, path: true, name: true, isLeaf: true },
      orderBy: [{ category2Id: "asc" }, { path: "asc" }],
    });

    const parentOptionsByC2: Record<string, { path: string; name: string; isLeaf: boolean }[]> = {};
    for (const n of allNodes) {
      (parentOptionsByC2[n.category2Id] ??= []).push({ path: n.path, name: n.name, isLeaf: n.isLeaf });
    }



  // “aktueller Monat”: wir nehmen den neuesten Run dieser MainCategory
  const latestRun = await prisma.importRun.findFirst({
    where: { mainCategoryId: main.id },
    orderBy: { month: "desc" },
    select: { id: true, month: true },
  });

  const month = latestRun?.month ?? null;

  // Unmapped LeafStrings kommen aus AggUnmappedParentMonth (entsteht beim Rollup-Lauf)
  const unmapped = month
    ? await prisma.aggUnmappedParentMonth.groupBy({
        by: ["category2Id", "leafString"],
        where: {
          month,
          category2Id: { in: category2Ids },
          leafString: { not: null },
        },
        _count: { _all: true },
      })
    : [];

  const byC2 = new Map<string, { leafString: string; parents: number }[]>();
  for (const r of unmapped) {
    if (!r.leafString) continue;
    const arr = byC2.get(r.category2Id) ?? [];
    arr.push({ leafString: r.leafString, parents: r._count._all });
    byC2.set(r.category2Id, arr);
  }

  for (const [k, arr] of byC2.entries()) {
    arr.sort((a, b) => b.parents - a.parents);
    byC2.set(k, arr);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0b", color: "#f5f5f5", minHeight: "100vh" }}>
      <Link href="/main" style={{ color: "#bdbdbd", textDecoration: "underline" }}>
        ← zurück
      </Link>

      <h1 style={{ marginTop: 12, fontSize: 22, fontWeight: 900 }}>
        Kategorien ergänzen · {main.name}
      </h1>

      <div style={{ marginTop: 8, color: "#bdbdbd" }}>
        Aktiver Monat (neuester Run): <b style={{ color: "#fff" }}>{month ?? "— noch kein Run vorhanden"}</b>
      </div>

      {latestRun ? (
        <div style={{ marginTop: 12 }}>
          <RecomputeLatestRunButton mainCategorySlug={mainCategorySlug} runId={latestRun.id} />
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <div style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
          <div style={{ fontWeight: 900 }}>Unmapped-Unterkategorien (aus Rollups)</div>
          <div style={{ color: "#bdbdbd", fontSize: 13, marginTop: 6 }}>
            Idee: Wenn du hier Leafs ergänzt, musst du danach für den aktuellen Monat die Pipeline/Rollups neu laufen lassen,
            damit das Mapping neu greift.
          </div>
        </div>

        {main.category2.map((c2) => {
          const items = byC2.get(c2.id) ?? [];
          const top = items.slice(0, 15);

          return (
            <div key={c2.id} style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{c2.name}</div>
                  <div style={{ color: "#bdbdbd", fontSize: 13 }}>
                    Unmapped Leafs: <b style={{ color: "#fff" }}>{items.length}</b>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <Link href={`/category-overview/${c2.id}`} style={{ color: "#fff", textDecoration: "underline" }}>
                    Category2 öffnen
                  </Link>
                  {latestRun ? (
                    <Link href={`/main/${mainCategorySlug}/runs/${latestRun.id}`} style={{ color: "#fff", textDecoration: "underline" }}>
                      Run öffnen
                    </Link>
                  ) : null}
                </div>
              </div>

              {top.length === 0 ? (
                <div style={{ marginTop: 10, color: "#777" }}>— aktuell keine Unmapped Leafs in diesem Monat —</div>
              ) : (
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {top.map((x) => (
                    <div key={x.leafString} style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 10, background: "#0f0f0f" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{x.leafString}</div>
                          <div style={{ color: "#bdbdbd", fontSize: 13 }}>
                            Parents betroffen: <b style={{ color: "#fff" }}>{x.parents}</b>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <AddLeafForm
                          category2Options={category2Options}
                          parentOptionsByC2={parentOptionsByC2}
                          defaultCategory2Id={c2.id}
                          defaultLeafName={x.leafString}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}