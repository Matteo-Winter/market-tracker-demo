import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const mainCategorySlug = String(body?.mainCategorySlug ?? "");
    const month = String(body?.month ?? "");
    const compareToRunIdRaw = body?.compareToRunId ?? null;

    if (!mainCategorySlug) {
      return NextResponse.json({ ok: false, error: "mainCategorySlug fehlt" }, { status: 400 });
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { ok: false, error: 'Month muss im Format YYYY-MM sein (z.B. "2026-02")' },
        { status: 400 }
      );
    }

    const mainCategory = await prisma.mainCategory.findUnique({
      where: { slug: mainCategorySlug },
      select: { id: true },
    });
    if (!mainCategory) {
      return NextResponse.json({ ok: false, error: "MainCategory nicht gefunden" }, { status: 404 });
    }

    const compareToRunId =
      typeof compareToRunIdRaw === "string" && compareToRunIdRaw.length > 0 ? compareToRunIdRaw : null;

    const result = await prisma.$transaction(async (tx) => {
      const run = await tx.importRun.create({
        data: {
          mainCategoryId: mainCategory.id,
          month,
          status: "CREATED",
          compareToRunId,
        },
        select: { id: true },
      });

      // RunCategory2-Links anlegen (alle Category2 der MainCategory)
      const c2s = await tx.category2.findMany({
        where: { mainCategoryId: mainCategory.id },
        select: { id: true },
      });

      if (c2s.length) {
        await tx.runCategory2.createMany({
          data: c2s.map((c2) => ({
            runId: run.id,
            category2Id: c2.id,
            isRequired: true,
            status: "MISSING",
          })),
          skipDuplicates: true,
        });
      }

      return run;
    });

    return NextResponse.json({ ok: true, runId: result.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 });
  }
}