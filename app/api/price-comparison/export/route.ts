import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { loadPriceComparisonView } from "@/lib/price-comparison/server";
import { getPriceComparisonTemplate, getTemplateWorkbookPath } from "@/lib/price-comparison/template";

export const dynamic = "force-dynamic";

function isoWeekLabel(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const utc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `KW${week}`;
}

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";

  if (!host) {
    throw new Error("Host konnte nicht bestimmt werden.");
  }

  return `${proto}://${host}`;
}

export async function GET(request: Request) {
  try {
    const templateWorkbookPath = getTemplateWorkbookPath();

    if (!templateWorkbookPath) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Bitte die Master-Vorlage unter "data/price-comparison/template.xlsx" hinterlegen.',
        },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const snapshotDate = url.searchParams.get("snapshot");

    const categories = getPriceComparisonTemplate();
    const views = await Promise.all(
      categories.map((category) =>
        loadPriceComparisonView({
          categoryId: category.id,
          snapshotDate,
        })
      )
    );

    const effectiveSnapshotDate =
      views.find((view) => view.selectedSnapshotDate)?.selectedSnapshotDate ??
      snapshotDate ??
      new Date().toISOString().slice(0, 10);

    const payload = {
      snapshotDate: effectiveSnapshotDate,
      categories: views
        .filter((view) => view.selectedCategory)
        .map((view) => ({
          id: view.selectedCategory!.id,
          label: view.selectedCategory!.label,
          rows: view.rows.map((row) => ({
            itemNumber: row.itemNumber,
            label: row.label,
            slots: row.slots.map((slot) => ({
              asin: slot.asin,
              current: slot.current
                ? {
                    price: slot.current.price,
                    bsr: slot.current.bsr,
                    reviewCount: slot.current.reviewCount,
                    rating: slot.current.rating,
                  }
                : null,
            })),
          })),
        })),
    };

    const weekLabel = isoWeekLabel(effectiveSnapshotDate);
    const filenameBase = weekLabel
      ? `competitor_analysis_${weekLabel}_${effectiveSnapshotDate}`
      : `competitor_analysis_${effectiveSnapshotDate}`;

    const baseUrl = await getBaseUrl();

    const pythonResponse = await fetch(`${baseUrl}/api/price-comparison-export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        payload,
        filenameBase,
        templatePath: "data/price-comparison/template.xlsx",
      }),
      cache: "no-store",
    });

    if (!pythonResponse.ok) {
      const text = await pythonResponse.text();
      return NextResponse.json(
        {
          ok: false,
          error: `Excel-Export in Python Function fehlgeschlagen. ${text || `HTTP ${pythonResponse.status}`}`,
        },
        { status: 500 }
      );
    }

    const arrayBuffer = await pythonResponse.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Export fehlgeschlagen.",
      },
      { status: 500 }
    );
  }
}