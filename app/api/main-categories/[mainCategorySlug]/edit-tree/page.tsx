export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AddNodesForm from "./AddNodesForm";

type Props = { params: Promise<{ mainCategorySlug: string }> };

export default async function EditTreePage({ params }: Props) {
  const { mainCategorySlug } = await params;

  const main = await prisma.mainCategory.findUnique({
    where: { slug: mainCategorySlug },
    include: { category2: { select: { id: true, name: true, slug: true } } },
  });

  if (!main) notFound();

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0b", color: "#f5f5f5", minHeight: "100vh" }}>
      <Link href="/main" style={{ color: "#fff", textDecoration: "underline" }}>
        ← zurück zum Dashboard
      </Link>

      <h1 style={{ marginTop: 12, fontSize: 22, fontWeight: 900 }}>Kategorien ergänzen (nur hinzufügen)</h1>
      <div style={{ color: "#bdbdbd", marginTop: 6 }}>
        MainCategory: <b>{main.name}</b> · Category2: <b>{main.category2.length}</b>
      </div>

      <div style={{ marginTop: 16 }}>
        <AddNodesForm mainCategorySlug={main.slug} />
      </div>

      <details style={{ marginTop: 16, border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
        <summary style={{ cursor: "pointer", fontWeight: 900 }}>Category2 Codes anzeigen</summary>
        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {main.category2.map((c2) => (
            <div key={c2.id} style={{ color: "#bdbdbd" }}>
              <span style={{ fontFamily: "monospace", color: "#fff" }}>{c2.slug.split("-")[0]}</span> — {c2.name}
            </div>
          ))}
        </div>
      </details>
    </main>
  );
}