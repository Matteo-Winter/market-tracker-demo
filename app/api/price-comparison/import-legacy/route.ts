import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { importHistoricWorkbook } from "@/lib/price-comparison/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let tempDir: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const yearRaw = formData.get("year");
    const year = typeof yearRaw === "string" && yearRaw.trim() ? Number(yearRaw) : null;

    if (!(file instanceof File)) {
      const url = new URL("/price-comparison", request.url);
      url.searchParams.set("error", "Bitte wähle eine historische Excel-Datei aus.");
      return NextResponse.redirect(url, 303);
    }

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "price-comparison-legacy-"));
    const workbookPath = path.join(tempDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(workbookPath, buffer);

    const result = await importHistoricWorkbook({
      filename: file.name,
      workbookPath,
      year: Number.isFinite(year) ? year : null,
    });

    const url = new URL("/price-comparison", request.url);
    url.searchParams.set("legacyImported", "1");
    url.searchParams.set("snapshot", result.snapshotDate);
    url.searchParams.set("matched", String(result.matchedCount));
    url.searchParams.set("ignored", String(result.ignoredCount));
    return NextResponse.redirect(url, 303);
  } catch (error) {
    const url = new URL("/price-comparison", request.url);
    url.searchParams.set(
      "error",
      error instanceof Error ? error.message : "Historische Excel konnte nicht importiert werden."
    );
    return NextResponse.redirect(url, 303);
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
