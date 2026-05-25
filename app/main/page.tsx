export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ImportMainCategoryForm from "./ImportMainCategoryForm";
import DeleteMainCategoryButton from "./DeleteMainCategoryButton";

export default async function MainDashboardPage() {
  const mains = await prisma.mainCategory.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      category2: { where: { deletedAt: null }, select: { id: true } },
      importRuns: { where: { deletedAt: null }, select: { id: true } },
    },
  });

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0b", color: "#f5f5f5", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Main Kategorien Dashboard</h1>
      <div style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Link href="/trash" style={{ color: "#fff", textDecoration: "underline" }}>
          Papierkorb
        </Link>
      </div>
      <p style={{ marginTop: 8, color: "#bdbdbd" }}>
        Einstieg (Golden Path): MainCategory → Runs → Batch aktivieren → Pipeline → Unmapped fixen → erneut Pipeline → Run vergleichen.
      </p>

      <div style={{ marginTop: 18 }}>
        <ImportMainCategoryForm />
      </div>

      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
        {mains.map((m) => (
          <div key={m.id} style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{m.name}</div>
                <div style={{ color: "#bdbdbd", fontSize: 13 }}>
                  slug: <span style={{ fontFamily: "monospace" }}>{m.slug}</span> · Category2: <b>{m.category2.length}</b> · Runs: <b>{m.importRuns.length}</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <Link href={`/main/${m.slug}/runs`} style={{ color: "#fff", textDecoration: "underline" }}>
                  Runs öffnen
                </Link>
                <Link href={`/main/${m.slug}/edit-tree`} style={{ color: "#fff", textDecoration: "underline" }}>
                  Kategorien ergänzen (Leafs)
                </Link>
                <Link href={`/category-overview`} style={{ color: "#bdbdbd", textDecoration: "underline" }}>
                  (alt) Category Overview
                </Link>
                <DeleteMainCategoryButton mainCategoryId={m.id} />
              </div>
            </div>
          </div>
        ))}
        {mains.length === 0 ? <div style={{ color: "#bdbdbd" }}>Noch keine MainCategory vorhanden. Importiere zuerst eine .txt.</div> : null}
      </div>
    </main>
  );
}