export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RunPipelineButton from "@/components/RunPipelineButton";

type Props = { params: Promise<{ mainCategorySlug: string }> };

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default async function MainCategoryDashboard({ params }: Props) {
  const { mainCategorySlug } = await params;

  const main = await prisma.mainCategory.findUnique({
    where: { slug: mainCategorySlug },
    include: {
      category2: {
        orderBy: { name: "asc" },
        include: {
          importBatches: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  if (!main) notFound();

  const rows = await Promise.all(
    main.category2.map(async (c2) => {
      const latest = c2.importBatches[0] ?? null;

      let unmappedCount: number | null = null;
      if (latest?.month && /^\d{4}-\d{2}$/.test(latest.month)) {
        unmappedCount = await prisma.productClassification.count({
          where: {
            month: latest.month,
            category2Id: c2.id,
            isUnmapped: true,
          },
        });
      }

      return { c2, latest, unmappedCount };
    })
  );

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0b", color: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#bdbdbd", fontSize: 13 }}>MainCategory Dashboard</div>
          <h1 style={{ marginTop: 6, fontSize: 24, fontWeight: 900 }}>{main.name}</h1>
          <div style={{ color: "#bdbdbd", marginTop: 6 }}>
            slug: <span style={{ fontFamily: "monospace" }}>{main.slug}</span>
          </div>
        </div>

        <div style={{ alignSelf: "flex-end" }}>
          <Link href="/rollups" style={{ color: "#fff", textDecoration: "underline" }}>
            → Rollups Übersicht
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 18, border: "1px solid #2a2a2a", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #2a2a2a", background: "#121212", fontWeight: 800 }}>
          Category2 (untergeordnete Kategorien)
        </div>

        <div style={{ padding: 12, display: "grid", gap: 12 }}>
          {rows.map(({ c2, latest, unmappedCount }) => {
            const monthOk = !!latest?.month && /^\d{4}-\d{2}$/.test(latest.month ?? "");
            const rollupHref = monthOk ? `/rollups/${latest!.month}/${c2.id}` : null;

            return (
              <div key={c2.id} style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#0f0f0f" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{c2.name}</div>
                    <div style={{ color: "#bdbdbd", fontSize: 13 }}>
                      category2Id: <span style={{ fontFamily: "monospace" }}>{c2.id}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <Link href={`/category-overview/${c2.id}`} style={{ color: "#fff", textDecoration: "underline" }}>
                      Category2 öffnen
                    </Link>
                    <Link href={`/main/${mainCategorySlug}/runs`} style={{ color: "#fff", textDecoration: "underline" }}>
                      → Import Runs (Monatsläufe)
                    </Link>

                    {latest ? (
                      <>
                        <Link href={`/imports/${latest.id}`} style={{ color: "#fff", textDecoration: "underline" }}>
                          Letzten Import öffnen
                        </Link>

                        <Link href={`/imports/${latest.id}/unmapped`} style={{ color: "#fff", textDecoration: "underline" }}>
                          Unmapped
                          {typeof unmappedCount === "number" ? ` (${unmappedCount})` : ""}
                        </Link>

                        {rollupHref ? (
                          <Link href={rollupHref} style={{ color: "#fff", textDecoration: "underline" }}>
                            Rollup {latest.month}
                          </Link>
                        ) : null}
                      </>
                    ) : (
                      <span style={{ color: "#bdbdbd" }}>Noch kein Import vorhanden</span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 10, color: "#bdbdbd", fontSize: 13 }}>
                  Latest Batch:{" "}
                  {latest ? (
                    <>
                      month: <b style={{ color: "#fff" }}>{latest.month ?? "-"}</b> · status:{" "}
                      <b style={{ color: "#fff" }}>{latest.status}</b> · created:{" "}
                      <b style={{ color: "#fff" }}>{fmtDate(latest.createdAt)}</b>
                    </>
                  ) : (
                    "–"
                  )}
                </div>

                {latest ? <RunPipelineButton batchId={latest.id} /> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 16, color: "#666", fontSize: 12 }}>
        Hinweis: UI wird später “schön” gemacht – diese Seite ist erstmal der funktionale Steuerpunkt.
      </div>
    </main>
  );
}