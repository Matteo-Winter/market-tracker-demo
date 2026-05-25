export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CreateRunForm from "./CreateRunForm";
import CompareRunForRun from "./CompareRunForRun";
import DeleteRunButton from "./DeleteRunButton";
import CollectedDateInput from "./CollectedDateInput";


type Props = {
  params: Promise<{ mainCategorySlug: string }>;
};

export default async function RunsPage({ params }: Props) {
  const { mainCategorySlug } = await params;

  const main = await prisma.mainCategory.findFirst({
    where: { slug: mainCategorySlug, deletedAt: null },
    select: { id: true, name: true, slug: true },
  });
  if (!main) notFound();

  const runs = await prisma.importRun.findMany({
    where: {
      mainCategoryId: main.id,
      deletedAt: null,
      status: { not: "TRASHED" },
    },
    orderBy: { month: "desc" },
    select: {
      id: true,
      month: true,
      status: true,
      collectedDate: true,
      compareToRunId: true,
      createdAt: true,
    },
  });

  const options = runs.map((r) => ({ id: r.id, month: r.month }));

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0b", color: "#f5f5f5", minHeight: "100vh" }}>
      <Link href="/main" style={{ color: "#fff", textDecoration: "underline" }}>
        ← zurück (Main Dashboard)
      </Link>
      <span style={{ marginLeft: 14 }}>
        <Link href={`/main/${main.slug}/runs/trash`} style={{ color: "#fff", textDecoration: "underline" }}>
          Papierkorb →
        </Link>
      </span>

      <h1 style={{ marginTop: 12, fontSize: 28, fontWeight: 900 }}>
        Import Runs · {main.name}
      </h1>

      <div style={{ marginTop: 14, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link href={`/main/${main.slug}/edit-tree`} style={{ color: "#fff", textDecoration: "underline" }}>
          Kategorien ergänzen →
        </Link>
        <Link href="/category-overview" style={{ color: "#bdbdbd", textDecoration: "underline" }}>
          (alt) Category Overview →
        </Link>
      </div>

      {/* ✅ Run erstellen passiert HIER */}
      <div style={{ marginTop: 18 }}>
        <CreateRunForm mainCategorySlug={main.slug} options={options} />
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {runs.map((r) => {
          const compareOptions = options.filter((o) => o.id !== r.id);

          return (
            <div key={r.id} style={{ border: "1px solid #2a2a2a", borderRadius: 14, padding: 14, background: "#121212" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 900 }}>
                    {r.month} · {r.status}
                  </div>
                  <div style={{ marginTop: 6, color: "#bdbdbd", fontFamily: "monospace" }}>
                    {r.id}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <Link
                    href={`/main/${main.slug}/runs/${r.id}`}
                    style={{ color: "#fff", textDecoration: "underline", fontWeight: 800 }}
                  >
                    Run öffnen →
                  </Link>
                  <CollectedDateInput runId={r.id} initialValue={r.collectedDate ?? null} />

                  <DeleteRunButton runId={r.id} />
                </div>
              </div>

              {/* ✅ Vergleich nur 1× pro Run */}
              <div style={{ marginTop: 10 }}>
                <CompareRunForRun runId={r.id} value={r.compareToRunId ?? ""} options={compareOptions} />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}