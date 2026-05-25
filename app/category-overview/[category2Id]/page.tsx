import { prisma } from "../../../lib/prisma";

import UploadHelium10Form from "./UploadHelium10Form";

import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ category2Id: string }>;
  searchParams: Promise<{ returnTo?: string; runId?: string; nodeId?: string | string[] }>;
};

export default async function Category2TreePage({ params, searchParams }: Props) {
  const { category2Id } = await params;
  const sp = await searchParams;

  // returnTo robust decoden (falls %2Fmain%2F... ankommt)
  let returnToDecoded: string | null = null;
  if (typeof sp.returnTo === "string") {
    try {
      returnToDecoded = decodeURIComponent(sp.returnTo);
    } catch {
      returnToDecoded = sp.returnTo; // war schon “normal”
    }
  }

  const back = returnToDecoded && returnToDecoded.startsWith("/") ? returnToDecoded : null;

  // Für Links innerhalb der Seite (damit returnTo nicht verloren geht)
  const backQ = back ? encodeURIComponent(back) : "";
  const runId = typeof sp.runId === "string" ? sp.runId : null;
  
  const nodeIdRaw = sp?.nodeId;
  const selectedNodeId =
    Array.isArray(nodeIdRaw) ? nodeIdRaw[0] : nodeIdRaw ?? null;

  const category2 = await prisma.category2.findUnique({
    where: { id: category2Id },
    include: { mainCategory: true },
  });

  if (!category2) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>Category2 nicht gefunden</h1>
      </main>
    );
  }

  const nodes = await prisma.categoryNode.findMany({
    where: {
      category2Id: category2.id,
      parentId: selectedNodeId,
    },
    orderBy: { path: "asc" },
    select: { id: true, name: true, path: true, isLeaf: true },
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
      <BackButton fallbackHref="/category-overview" />

      <h1 style={{ marginTop: 12, fontSize: 22, fontWeight: 800 }}>
        {category2.mainCategory.name} → {category2.name}
      </h1>

      <p style={{ marginTop: 6, color: "#bdbdbd" }}>
        {selectedNodeId ? "Kinder des ausgewählten Nodes" : "Root-Nodes (erste Ebene)"}
      </p>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #2a2a2a",
          background: "#121212",
          borderRadius: 12,
          padding: 16,
        }}
      >
        {nodes.length === 0 ? (
          <div style={{ color: "#9a9a9a" }}>Keine Nodes gefunden.</div>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {nodes.map((n) => (
              <li key={n.id} style={{ marginTop: 6 }}>
                <span style={{ fontFamily: "monospace", color: "#cfcfcf" }}>
                  {n.path}
                </span>{" "}
                — {n.name}{" "}
                {!n.isLeaf ? (
                  <a
                    href={`/category-overview/${category2.id}?nodeId=${n.id}`}
                    style={{
                      marginLeft: 8,
                      color: "#ffffff",
                      textDecoration: "underline",
                    }}
                  >
                    öffnen
                  </a>
                ) : (
                  <span style={{ marginLeft: 8, color: "#9a9a9a" }}>(Leaf)</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <UploadHelium10Form category2Id={category2.id} />

    </main>
  );
  
}
