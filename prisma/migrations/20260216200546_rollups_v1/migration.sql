-- AlterTable
ALTER TABLE "ProductRow" ADD COLUMN     "bsr" INTEGER,
ADD COLUMN     "subcatBsr" INTEGER;

-- CreateTable
CREATE TABLE "AggParentProductMonth" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "category2Id" TEXT NOT NULL,
    "parentProductId" TEXT NOT NULL,
    "representativeAsin" TEXT NOT NULL,
    "representativeUrl" TEXT,
    "brandNorm" TEXT,
    "leafString" TEXT,
    "leafNodeId" TEXT,
    "order3NodeId" TEXT,
    "isUnmapped" BOOLEAN NOT NULL DEFAULT false,
    "parentRevenue" DOUBLE PRECISION,
    "parentSales" INTEGER,
    "asinRevenueSum" DOUBLE PRECISION,
    "asinSalesSum" INTEGER,
    "childAsinCount" INTEGER NOT NULL,
    "priceMedian" DOUBLE PRECISION,
    "bsrMedian" INTEGER,
    "subcatBsrMedian" INTEGER,
    "reviewsCountMedian" INTEGER,
    "ratingMedian" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggParentProductMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggBrandNodeMonth" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "category2Id" TEXT NOT NULL,
    "brandNorm" TEXT NOT NULL,
    "revenueSum" DOUBLE PRECISION,
    "salesSum" INTEGER,
    "parentProductsCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggBrandNodeMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggCategoryNodeMonth" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "mainCategoryId" TEXT NOT NULL,
    "scopeLevel" INTEGER NOT NULL,
    "scopeId" TEXT NOT NULL,
    "category2Id" TEXT,
    "nodeId" TEXT,
    "nodeName" TEXT,
    "revenueSum" DOUBLE PRECISION,
    "salesSum" INTEGER,
    "parentProductsCount" INTEGER NOT NULL,
    "brandsCount" INTEGER NOT NULL,
    "priceMedian" DOUBLE PRECISION,
    "bsrMedian" INTEGER,
    "subcatBsrMedian" INTEGER,
    "top10BrandShare" DOUBLE PRECISION,
    "topBrandNorm" TEXT,
    "topBrandRevenue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggCategoryNodeMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggUnmappedParentMonth" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "category2Id" TEXT NOT NULL,
    "parentProductId" TEXT NOT NULL,
    "representativeAsin" TEXT NOT NULL,
    "leafString" TEXT,
    "parentRevenue" DOUBLE PRECISION,
    "parentSales" INTEGER,
    "childAsinCount" INTEGER NOT NULL,
    "brandNorm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggUnmappedParentMonth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AggParentProductMonth_category2Id_month_idx" ON "AggParentProductMonth"("category2Id", "month");

-- CreateIndex
CREATE INDEX "AggParentProductMonth_parentProductId_idx" ON "AggParentProductMonth"("parentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "AggParentProductMonth_month_category2Id_parentProductId_key" ON "AggParentProductMonth"("month", "category2Id", "parentProductId");

-- CreateIndex
CREATE INDEX "AggBrandNodeMonth_category2Id_month_idx" ON "AggBrandNodeMonth"("category2Id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "AggBrandNodeMonth_month_category2Id_brandNorm_key" ON "AggBrandNodeMonth"("month", "category2Id", "brandNorm");

-- CreateIndex
CREATE INDEX "AggCategoryNodeMonth_mainCategoryId_month_idx" ON "AggCategoryNodeMonth"("mainCategoryId", "month");

-- CreateIndex
CREATE INDEX "AggCategoryNodeMonth_category2Id_month_idx" ON "AggCategoryNodeMonth"("category2Id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "AggCategoryNodeMonth_month_scopeLevel_scopeId_key" ON "AggCategoryNodeMonth"("month", "scopeLevel", "scopeId");

-- CreateIndex
CREATE INDEX "AggUnmappedParentMonth_category2Id_month_idx" ON "AggUnmappedParentMonth"("category2Id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "AggUnmappedParentMonth_month_category2Id_parentProductId_key" ON "AggUnmappedParentMonth"("month", "category2Id", "parentProductId");

-- AddForeignKey
ALTER TABLE "AggParentProductMonth" ADD CONSTRAINT "AggParentProductMonth_category2Id_fkey" FOREIGN KEY ("category2Id") REFERENCES "Category2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggParentProductMonth" ADD CONSTRAINT "AggParentProductMonth_parentProductId_fkey" FOREIGN KEY ("parentProductId") REFERENCES "ParentProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggBrandNodeMonth" ADD CONSTRAINT "AggBrandNodeMonth_category2Id_fkey" FOREIGN KEY ("category2Id") REFERENCES "Category2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggUnmappedParentMonth" ADD CONSTRAINT "AggUnmappedParentMonth_category2Id_fkey" FOREIGN KEY ("category2Id") REFERENCES "Category2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
