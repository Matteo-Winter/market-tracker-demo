import { NextResponse } from "next/server";
import { importCompetitorCsv } from "@/lib/price-comparison/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      const url = new URL("/price-comparison", request.url);
      url.searchParams.set("error", "Bitte wähle eine CSV-Datei aus.");
      return NextResponse.redirect(url, 303);
    }

    const csvText = await file.text();
    const result = await importCompetitorCsv({
      filename: file.name,
      csvText,
    });

    const url = new URL("/price-comparison", request.url);
    url.searchParams.set("imported", "1");
    url.searchParams.set("snapshot", result.snapshotDate);
    url.searchParams.set("matched", String(result.matchedCount));
    url.searchParams.set("ignored", String(result.ignoredCount));
    return NextResponse.redirect(url, 303);
  } catch (error) {
    const url = new URL("/price-comparison", request.url);
    url.searchParams.set(
      "error",
      error instanceof Error ? error.message : "CSV konnte nicht importiert werden."
    );
    return NextResponse.redirect(url, 303);
  }
}
