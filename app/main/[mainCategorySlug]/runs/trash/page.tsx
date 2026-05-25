export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RestoreRunButton from "./RestoreRunButton";
import PurgeRunButton from "./PurgeRunButton";

type Props = { params: Promise<{ mainCategorySlug: string }> };

export default async function RunsTrashPage({ params }: Props) {
  const { mainCategorySlug } = await params;

  const main = await prisma.mainCategory.findUnique({
    where: { slug: mainCategorySlug },
    select: { id: true, name: true, slug: true },
  });
  if (!main) notFound();

  const trashed = await prisma.importRun.findMany({
    where: { mainCategoryId: main.id, status: "TRASHED" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, month: true, note: true, updatedAt: true },
  });

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0b", color: "#f5f5f5", minHeight: "100vh" }}>
      <Link href={`/main/${main.slug}/runs`} style={{ color: "#fff", textDecoration: "underline" }}>
        ← zurück zu Runs
      </Link>

      <h1 style={{ marginTop: 12, fontSize: 28, fontWeight: 900 }}>
        Papierkorb · Runs · {main.name}
      </h1>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {trashed.map((r) => (
          <div key={r.id} style={{ border: "1px solid #2a2a2a", borderRadius: 14, padding: 14, background: "#121212" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{r.month}</div>
            <div style={{ color: "#bdbdbd", fontFamily: "monospace", marginTop: 6 }}>{r.id}</div>
            <div style={{ color: "#bdbdbd", marginTop: 6 }}>
              updated: {new Date(r.updatedAt).toLocaleString("de-DE")}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <RestoreRunButton runId={r.id} />
              <PurgeRunButton runId={r.id} />
            </div>
          </div>
        ))}
        {trashed.length === 0 ? <div style={{ color: "#bdbdbd" }}>Papierkorb ist leer.</div> : null}
      </div>
    </main>
  );
}