import { prisma } from "../prisma";

type ParentAggRow = {
  month: string;
  category2Id: string;
  parentProductId: string;
  representativeAsin: string;
  representativeUrl: string | null;
  brandNorm: string | null;

  leafString: string | null;
  leafNodeId: string | null;
  order3NodeId: string | null;
  isUnmapped: boolean;

  parentRevenue: number | null;
  parentSales: number | null;

  asinRevenueSum: number;
  asinSalesSum: number;

  childAsinCount: number;
  priceMedian: number | null;
  priceQ1: number | null;
  priceQ3: number | null;
  priceMin: number | null;
  priceMax: number | null;

  bsrMedian: number | null;
  subcatBsrMedian: number | null;

  reviewsCountMedian: number | null;
  ratingMedian: number | null;

  revenueCoverage: number | null;
  salesCoverage: number | null;
};

function median(nums: number[]): number | null {
  const a = nums.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (a.length === 0) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function quantile(nums: (number | null | undefined)[], q: number) {
  const a = nums.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  if (a.length === 1) return a[0];
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const left = a[base];
  const right = a[Math.min(base + 1, a.length - 1)];
  return left + (right - left) * rest;
}

function minValue(nums: (number | null | undefined)[]) {
  const a = nums.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return a.length ? Math.min(...a) : null;
}

function maxValue(nums: (number | null | undefined)[]) {
  const a = nums.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return a.length ? Math.max(...a) : null;
}

function medianFloat(nums: (number | null | undefined)[]) {
  return median(nums.filter((x): x is number => typeof x === "number"));
}

function medianInt(nums: (number | null | undefined)[]) {
  const m = median(nums.filter((x): x is number => typeof x === "number"));
  return m == null ? null : Math.round(m);
}

function sumFloat(nums: (number | null | undefined)[]): number {
  return nums.reduce((acc: number, v) => acc + (typeof v === "number" ? v : 0), 0);
}

function sumInt(nums: (number | null | undefined)[]): number {
  return nums.reduce((acc: number, v) => acc + (typeof v === "number" ? v : 0), 0);
}

function modeString(values: string[]) {
  if (!values.length) return null;
  const freq = new Map<string, number>();
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function top10BrandShare(items: { brandNorm: string | null; revenue: number | null }[]) {
  const by = new Map<string, number>();
  let total = 0;

  for (const it of items) {
    const rev = typeof it.revenue === "number" ? it.revenue : 0;
    total += rev;
    const b = it.brandNorm ?? "__no_brand__";
    by.set(b, (by.get(b) ?? 0) + rev);
  }

  const top10 = [...by.values()]
    .sort((a, b) => b - a)
    .slice(0, 10)
    .reduce((a: number, b: number) => a + b, 0);
  return total > 0 ? top10 / total : null;
}

function ratio(numerator?: number | null, denominator?: number | null) {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

export async function recomputeRollups(batchId: string) {
  if (!batchId) throw new Error("batchId fehlt.");

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { category2: { include: { mainCategory: true } } },
  });
  if (!batch) throw new Error("Batch nicht gefunden.");
  if (!batch.month) throw new Error("Batch.month fehlt.");

  const month = batch.month;
  const category2Id = batch.category2Id;
  const mainCategoryId = batch.category2.mainCategoryId;

  const mappings = await prisma.childToParentMap.findMany({
    where: { month, category2Id },
    select: { childAsin: true, parentProductId: true, representativeAsin: true },
  });

  if (mappings.length === 0) {
    throw new Error("Keine ChildToParentMap-Einträge gefunden. Bitte zuerst processBatch für diesen Batch laufen lassen.");
  }

  const childToParent = new Map(mappings.map((m) => [m.childAsin, m.parentProductId]));

  const rows = await prisma.productRow.findMany({
    where: { month, category2Id },
    select: {
      asin: true,
      price: true,
      parentRevenue: true,
      parentSales: true,
      asinRevenue: true,
      asinSales: true,
      reviewsCount: true,
      rating: true,
      brandNorm: true,
      bsr: true,
      subcatBsr: true,
    },
  });

  const classifs = await prisma.productClassification.findMany({
    where: { month, category2Id },
    select: { parentProductId: true, leafString: true, leafNodeId: true, order3NodeId: true, isUnmapped: true },
  });
  const classifByParent = new Map(classifs.map((c) => [c.parentProductId, c]));

  const parentIds = [...new Set(mappings.map((m) => m.parentProductId))];
  const parents = await prisma.parentProduct.findMany({
    where: { id: { in: parentIds } },
    select: { id: true, representativeAsin: true, representativeUrl: true, brandNorm: true },
  });
  const parentById = new Map(parents.map((p) => [p.id, p]));

  const repTmp = new Map<string, string[]>();
  for (const m of mappings) {
    const arr = repTmp.get(m.parentProductId) ?? [];
    arr.push(m.representativeAsin);
    repTmp.set(m.parentProductId, arr);
  }
  const repAsinByParent = new Map<string, string>();
  for (const [pid, reps] of repTmp.entries()) {
    const rep = modeString(reps) ?? parentById.get(pid)?.representativeAsin ?? "";
    if (rep) repAsinByParent.set(pid, rep);
  }

  const group = new Map<string, typeof rows>();
  for (const r of rows) {
    const pid = childToParent.get(r.asin);
    if (!pid) continue;
    const arr = group.get(pid) ?? [];
    arr.push(r);
    group.set(pid, arr);
  }

  const parentAggRows: ParentAggRow[] = [];
  for (const [parentProductId, childRows] of group.entries()) {
    const cls = classifByParent.get(parentProductId);
    const base = parentById.get(parentProductId);

    const parentRevenue = medianFloat(childRows.map((x) => x.parentRevenue));
    const parentSales = medianInt(childRows.map((x) => x.parentSales));

    const asinRevenueSum = sumFloat(childRows.map((x) => x.asinRevenue));
    const asinSalesSum = sumInt(childRows.map((x) => x.asinSales));

    const prices = childRows.map((x) => x.price);
    const priceMedian = medianFloat(prices);
    const priceQ1 = quantile(prices, 0.25);
    const priceQ3 = quantile(prices, 0.75);
    const priceMin = minValue(prices);
    const priceMax = maxValue(prices);

    const bsrMedian = medianInt(childRows.map((x) => x.bsr));
    const subcatBsrMedian = medianInt(childRows.map((x) => x.subcatBsr));
    const reviewsCountMedian = medianInt(childRows.map((x) => x.reviewsCount));
    const ratingMedian = medianFloat(childRows.map((x) => x.rating));

    parentAggRows.push({
      month,
      category2Id,
      parentProductId,
      representativeAsin: repAsinByParent.get(parentProductId) ?? base?.representativeAsin ?? "",
      representativeUrl: base?.representativeUrl ?? null,
      brandNorm: base?.brandNorm ?? null,
      leafString: cls?.leafString ?? null,
      leafNodeId: cls?.leafNodeId ?? null,
      order3NodeId: cls?.order3NodeId ?? null,
      isUnmapped: cls?.isUnmapped ?? false,
      parentRevenue,
      parentSales,
      asinRevenueSum,
      asinSalesSum,
      childAsinCount: childRows.length,
      priceMedian,
      priceQ1,
      priceQ3,
      priceMin,
      priceMax,
      bsrMedian,
      subcatBsrMedian,
      reviewsCountMedian,
      ratingMedian,
      revenueCoverage: ratio(asinRevenueSum, parentRevenue),
      salesCoverage: ratio(asinSalesSum, parentSales),
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.aggParentProductMonth.deleteMany({ where: { month, category2Id } });
    await tx.aggBrandNodeMonth.deleteMany({ where: { month, category2Id } });
    await tx.aggUnmappedParentMonth.deleteMany({ where: { month, category2Id } });

    await tx.aggCategoryNodeMonth.deleteMany({
      where: {
        month,
        OR: [
          { scopeLevel: 2, scopeId: category2Id },
          { scopeLevel: 3, category2Id },
          { scopeLevel: 1, scopeId: mainCategoryId },
        ],
      },
    });

    if (parentAggRows.length) {
      await tx.aggParentProductMonth.createMany({ data: parentAggRows });
    }

    const unmapped = parentAggRows.filter((p) => p.isUnmapped);
    if (unmapped.length) {
      await tx.aggUnmappedParentMonth.createMany({
        data: unmapped.map((p) => ({
          month,
          category2Id,
          parentProductId: p.parentProductId,
          representativeAsin: p.representativeAsin,
          leafString: p.leafString,
          parentRevenue: p.parentRevenue,
          parentSales: p.parentSales,
          childAsinCount: p.childAsinCount,
          brandNorm: p.brandNorm,
        })),
      });
    }

    const byBrand = new Map<string, { revenue: number; sales: number; parents: number }>();
    for (const p of parentAggRows) {
      if (p.isUnmapped) continue;
      if (p.parentRevenue == null || p.parentSales == null) continue;
      const b = p.brandNorm ?? "__no_brand__";
      const cur = byBrand.get(b) ?? { revenue: 0, sales: 0, parents: 0 };
      cur.revenue += p.parentRevenue;
      cur.sales += p.parentSales;
      cur.parents += 1;
      byBrand.set(b, cur);
    }

    const brandRows = [...byBrand.entries()].map(([brandNorm, v]) => ({
      month,
      category2Id,
      brandNorm,
      revenueSum: v.revenue,
      salesSum: v.sales,
      parentProductsCount: v.parents,
    }));
    if (brandRows.length) {
      await tx.aggBrandNodeMonth.createMany({ data: brandRows });
    }

    const mappedParents = parentAggRows.filter((p) => !p.isUnmapped && p.parentRevenue != null && p.parentSales != null);

    const byOrder3 = new Map<string, ParentAggRow[]>();
    for (const p of mappedParents) {
      if (!p.order3NodeId) continue;
      const arr = byOrder3.get(p.order3NodeId) ?? [];
      arr.push(p);
      byOrder3.set(p.order3NodeId, arr);
    }

    const nodeIds = [...byOrder3.keys()];
    const nodes = nodeIds.length
      ? await tx.categoryNode.findMany({ where: { id: { in: nodeIds } }, select: { id: true, name: true } })
      : [];
    const nodeNameById = new Map(nodes.map((n) => [n.id, n.name]));

    const order3Rows = [...byOrder3.entries()].map(([nodeId, ps]) => {
      const brandRev = new Map<string, number>();
      for (const x of ps) {
        const b = x.brandNorm ?? "__no_brand__";
        brandRev.set(b, (brandRev.get(b) ?? 0) + (x.parentRevenue ?? 0));
      }
      const topBrand = [...brandRev.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

      return {
        month,
        mainCategoryId,
        scopeLevel: 3,
        scopeId: nodeId,
        category2Id,
        nodeId,
        nodeName: nodeNameById.get(nodeId) ?? null,
        revenueSum: sumFloat(ps.map((x) => x.parentRevenue)),
        salesSum: sumInt(ps.map((x) => x.parentSales)),
        parentProductsCount: ps.length,
        brandsCount: new Set(ps.map((x) => x.brandNorm ?? "__no_brand__")).size,
        priceMedian: medianFloat(ps.map((x) => x.priceMedian)),
        priceQ1: quantile(ps.map((x) => x.priceMedian), 0.25),
        priceQ3: quantile(ps.map((x) => x.priceMedian), 0.75),
        bsrMedian: medianInt(ps.map((x) => x.bsrMedian)),
        subcatBsrMedian: medianInt(ps.map((x) => x.subcatBsrMedian)),
        top10BrandShare: top10BrandShare(ps.map((x) => ({ brandNorm: x.brandNorm, revenue: x.parentRevenue }))),
        topBrandNorm: topBrand ? topBrand[0] : null,
        topBrandRevenue: topBrand ? topBrand[1] : null,
      };
    });

    const brandRev2 = new Map<string, number>();
    for (const x of mappedParents) {
      const b = x.brandNorm ?? "__no_brand__";
      brandRev2.set(b, (brandRev2.get(b) ?? 0) + (x.parentRevenue ?? 0));
    }
    const topBrand2 = [...brandRev2.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    const order2Row = {
      month,
      mainCategoryId,
      scopeLevel: 2,
      scopeId: category2Id,
      category2Id,
      nodeId: null,
      nodeName: batch.category2.name,
      revenueSum: sumFloat(mappedParents.map((x) => x.parentRevenue)),
      salesSum: sumInt(mappedParents.map((x) => x.parentSales)),
      parentProductsCount: mappedParents.length,
      brandsCount: new Set(mappedParents.map((x) => x.brandNorm ?? "__no_brand__")).size,
      priceMedian: medianFloat(mappedParents.map((x) => x.priceMedian)),
      priceQ1: quantile(mappedParents.map((x) => x.priceMedian), 0.25),
      priceQ3: quantile(mappedParents.map((x) => x.priceMedian), 0.75),
      bsrMedian: medianInt(mappedParents.map((x) => x.bsrMedian)),
      subcatBsrMedian: medianInt(mappedParents.map((x) => x.subcatBsrMedian)),
      top10BrandShare: top10BrandShare(mappedParents.map((x) => ({ brandNorm: x.brandNorm, revenue: x.parentRevenue }))),
      topBrandNorm: topBrand2 ? topBrand2[0] : null,
      topBrandRevenue: topBrand2 ? topBrand2[1] : null,
    };

    const allMainParents = await tx.aggParentProductMonth.findMany({
      where: { month, isUnmapped: false, category2: { mainCategoryId } },
      select: {
        parentRevenue: true,
        parentSales: true,
        brandNorm: true,
        priceMedian: true,
        bsrMedian: true,
        subcatBsrMedian: true,
      },
    });

    const allMainValid = allMainParents.filter((x) => x.parentRevenue != null && x.parentSales != null);
    const brandRev1 = new Map<string, number>();
    for (const x of allMainValid) {
      const b = x.brandNorm ?? "__no_brand__";
      brandRev1.set(b, (brandRev1.get(b) ?? 0) + (x.parentRevenue ?? 0));
    }
    const topBrand1 = [...brandRev1.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    const order1Row = {
      month,
      mainCategoryId,
      scopeLevel: 1,
      scopeId: mainCategoryId,
      category2Id: null,
      nodeId: null,
      nodeName: batch.category2.mainCategory.name,
      revenueSum: sumFloat(allMainValid.map((x) => x.parentRevenue)),
      salesSum: sumInt(allMainValid.map((x) => x.parentSales)),
      parentProductsCount: allMainValid.length,
      brandsCount: new Set(allMainValid.map((x) => x.brandNorm ?? "__no_brand__")).size,
      priceMedian: medianFloat(allMainValid.map((x) => x.priceMedian)),
      priceQ1: quantile(allMainValid.map((x) => x.priceMedian), 0.25),
      priceQ3: quantile(allMainValid.map((x) => x.priceMedian), 0.75),
      bsrMedian: medianInt(allMainValid.map((x) => x.bsrMedian)),
      subcatBsrMedian: medianInt(allMainValid.map((x) => x.subcatBsrMedian)),
      top10BrandShare: top10BrandShare(allMainValid.map((x) => ({ brandNorm: x.brandNorm, revenue: x.parentRevenue }))),
      topBrandNorm: topBrand1 ? topBrand1[0] : null,
      topBrandRevenue: topBrand1 ? topBrand1[1] : null,
    };

    const catRows = [...order3Rows, order2Row, order1Row];
    await tx.aggCategoryNodeMonth.createMany({ data: catRows });
  });

  console.log("✅ Rollups fertig");
  console.log("month:", month);
  console.log("category2Id:", category2Id);
  console.log("parents in agg:", parentAggRows.length);
}
