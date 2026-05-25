import { prisma } from "../../../lib/prisma";

import RunPipelineButton from "@/components/RunPipelineButton";

import BackButton from "@/components/BackButton";
import SetActiveInRunFromContext from "@/components/SetActiveInRunFromContext";
import DeleteBatchButton from "@/components/DeleteBatchButton";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ returnTo?: string; runId?: string }>;
};

export default async function ImportBatchPage({ params, searchParams }: Props) {
  const { batchId } = await params;
  const sp = await searchParams;

  let returnToDecoded: string | null = null;
  if (typeof sp.returnTo === "string") {
    try {
      returnToDecoded = decodeURIComponent(sp.returnTo);
    } catch {
      returnToDecoded = sp.returnTo;
    }
  }

  const back = returnToDecoded && returnToDecoded.startsWith("/") ? returnToDecoded : null;
  const backQ = back ? encodeURIComponent(back) : "";
  const runId = typeof sp.runId === "string" ? sp.runId : null;
  const runIdQ = runId ? encodeURIComponent(runId) : "";
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      category2: { include: { mainCategory: true } },
      files: true,
    },
  });

  if (!batch) {
    return <main style={{ padding: 24, fontFamily: "system-ui" }}>Batch nicht gefunden.</main>;
  }

  const file = batch.files[0];
  const text = file?.contentText ?? "";
  const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 15);

  const q = back || runId
    ? `?${back ? `returnTo=${backQ}` : ""}${back && runId ? "&" : ""}${runId ? `runId=${runIdQ}` : ""}`
    : "";

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0b", color: "#f5f5f5", minHeight: "100vh" }}>
      <BackButton fallbackHref={`/category-overview/${batch.category2Id}`} />
      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <DeleteBatchButton batchId={batchId} backHref={back ?? `/category-overview/${batch.category2Id}`} mode="auto" />
      </div>

      <h1 style={{ marginTop: 12, fontSize: 22, fontWeight: 800 }}>
        Import Preview: {batch.category2.mainCategory.name} → {batch.category2.name}
      </h1>
      <p style={{ color: "#bdbdbd" }}>
        Month: {batch.month ?? "-"} | Status: {batch.status}
      </p>
      <SetActiveInRunFromContext batchId={batchId} category2Id={batch.category2Id} />
      <RunPipelineButton batchId={batchId} />

      <div style={{ marginTop: 12, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <a
          href={`/imports/${batch.id}/unmapped${q}`}
          style={{ color: "#ffffff", textDecoration: "underline", display: "inline-block" }}
        >
          Unmapped Queue anzeigen →
        </a>
        <a
          href={`/imports/${batch.id}/mapping-lab`}
          style={{ color: "#b9d4ff", textDecoration: "underline", display: "inline-block" }}
        >
          Mapping Lab öffnen →
        </a>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
        <div style={{ fontWeight: 800 }}>Datei</div>
        <div style={{ color: "#bdbdbd" }}>{file ? file.filename : "keine Datei"}</div>

        <div style={{ marginTop: 12, fontWeight: 800 }}>Preview (erste Zeilen)</div>
        <pre style={{ marginTop: 8, padding: 12, background: "#0f0f0f", borderRadius: 10, overflowX: "auto" }}>
{lines.join("\n")}
        </pre>
      </div>
    </main>
  );
}
