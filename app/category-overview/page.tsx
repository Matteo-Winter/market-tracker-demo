import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function CategoryOverviewPage() {
  const main = await prisma.mainCategory.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      category2: {
        orderBy: { createdAt: "asc" },
        include: {
          nodes: {
            where: { parentId: null },
            orderBy: { path: "asc" },
            select: { id: true, name: true, path: true, isLeaf: true },
          },
        },
      },
    },
  });

  const pageStyle: React.CSSProperties = {
    padding: 24,
    fontFamily: "system-ui",
    background: "#0b0b0b",
    color: "#f5f5f5",
    minHeight: "100vh",
  };

  return (
    <main style={pageStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Kategorie-Overview</h1>
      <p style={{ marginTop: 8, color: "#bdbdbd" }}>
        Zeigt MainCategory → Category2 → Root-Nodes (erste Ebene im Tree).
      </p>

      <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
        {main.map((m) => (
          <section
            key={m.id}
            style={{
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: 16,
              background: "#121212",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>{m.name}</h2>

            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              {m.category2.map((c2) => (
                <div
                  key={c2.id}
                  style={{
                    border: "1px solid #2a2a2a",
                    borderRadius: 12,
                    padding: 12,
                    background: "#171717",
                  }}
                >
                  <a
                    href={`/category-overview/${c2.id}`}
                    style={{ fontWeight: 800, color: "#ffffff", textDecoration: "underline" }}
                  >
                    {c2.slug} — {c2.name}
                  </a>


                  <div style={{ marginTop: 8, color: "#bdbdbd", fontSize: 13 }}>
                    Root-Nodes (erste Ebene):
                  </div>

                  <ul style={{ marginTop: 6, paddingLeft: 18, color: "#eaeaea" }}>
                    {c2.nodes.length === 0 ? (
                      <li style={{ color: "#9a9a9a" }}>Keine Root-Nodes gefunden</li>
                    ) : (
                      c2.nodes.map((n) => (
                        <li key={n.id} style={{ marginTop: 2 }}>
                          <span style={{ fontFamily: "monospace", color: "#cfcfcf" }}>
                            {n.path}
                          </span>{" "}
                          — {n.name} {n.isLeaf ? "(Leaf)" : ""}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
