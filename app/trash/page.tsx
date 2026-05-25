export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import TrashActions from "./trashActions";

export default async function TrashPage() {
  const deletedMains = await prisma.mainCategory.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
  });

  const deletedRuns = await prisma.importRun.findMany({
    where: {
      OR: [
        { deletedAt: { not: null } },
        { status: "TRASHED" },
      ],
    },
    include: { mainCategory: true },
    orderBy: [{ deletedAt: "desc" }, { updatedAt: "desc" }],
    take: 200,
  });

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0b", color: "#f5f5f5", minHeight: "100vh" }}>
      <Link href="/main" style={{ color: "#bdbdbd", textDecoration: "underline" }}>← zurück</Link>
      <h1 style={{ marginTop: 12, fontSize: 22, fontWeight: 900 }}>Papierkorb</h1>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <section style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
          <div style={{ fontWeight: 900 }}>Gelöschte Main Categories</div>
          {deletedMains.length === 0 ? <div style={{ color: "#888", marginTop: 8 }}>— keine —</div> : null}

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {deletedMains.map((m) => (
              <div key={m.id} style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 10, background: "#0f0f0f" }}>
                <div style={{ fontWeight: 800 }}>{m.name} <span style={{ color: "#888" }}>({m.slug})</span></div>
                <div style={{ color: "#bdbdbd", fontSize: 13 }}>deletedAt: {String(m.deletedAt)}</div>
                <TrashActions type="main" id={m.id} />
              </div>
            ))}
          </div>
        </section>

        <section style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
          <div style={{ fontWeight: 900 }}>Gelöschte Runs</div>
          {deletedRuns.length === 0 ? <div style={{ color: "#888", marginTop: 8 }}>— keine —</div> : null}

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {deletedRuns.map((r) => (
              <div key={r.id} style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 10, background: "#0f0f0f" }}>
                <div style={{ fontWeight: 800 }}>
                  {r.mainCategory.name} · {r.month} · <span style={{ color: "#888" }}>{r.id.slice(0, 8)}…</span>
                </div>
                <div style={{ color: "#bdbdbd", fontSize: 13 }}>deletedAt: {String(r.deletedAt)}</div>
                <TrashActions type="run" id={r.id} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}