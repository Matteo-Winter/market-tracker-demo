-- CreateTable
CREATE TABLE "ProductRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "category2Id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "asin" TEXT NOT NULL,
    "title" TEXT,
    "brand" TEXT,
    "brandNorm" TEXT,
    "imageUrl" TEXT,
    "leafString" TEXT,
    "price" DOUBLE PRECISION,
    "parentRevenue" DOUBLE PRECISION,
    "parentSales" INTEGER,
    "asinRevenue" DOUBLE PRECISION,
    "asinSales" INTEGER,
    "reviewsCount" INTEGER,
    "rating" DOUBLE PRECISION,
    "ean" TEXT,
    "gtin" TEXT,
    "upc" TEXT,
    "isbn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentProduct" (
    "id" TEXT NOT NULL,
    "category2Id" TEXT NOT NULL,
    "representativeAsin" TEXT NOT NULL,
    "representativeUrl" TEXT,
    "brandNorm" TEXT,
    "titleNorm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildToParentMap" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "category2Id" TEXT NOT NULL,
    "childAsin" TEXT NOT NULL,
    "parentProductId" TEXT NOT NULL,
    "representativeAsin" TEXT NOT NULL,
    "method" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildToParentMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductClassification" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "category2Id" TEXT NOT NULL,
    "parentProductId" TEXT NOT NULL,
    "leafString" TEXT,
    "leafNodeId" TEXT,
    "order3NodeId" TEXT,
    "isUnmapped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductClassification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRow_batchId_idx" ON "ProductRow"("batchId");

-- CreateIndex
CREATE INDEX "ProductRow_category2Id_month_idx" ON "ProductRow"("category2Id", "month");

-- CreateIndex
CREATE INDEX "ProductRow_asin_idx" ON "ProductRow"("asin");

-- CreateIndex
CREATE INDEX "ParentProduct_category2Id_idx" ON "ParentProduct"("category2Id");

-- CreateIndex
CREATE INDEX "ParentProduct_representativeAsin_idx" ON "ParentProduct"("representativeAsin");

-- CreateIndex
CREATE INDEX "ChildToParentMap_category2Id_month_idx" ON "ChildToParentMap"("category2Id", "month");

-- CreateIndex
CREATE INDEX "ChildToParentMap_parentProductId_idx" ON "ChildToParentMap"("parentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildToParentMap_month_category2Id_childAsin_key" ON "ChildToParentMap"("month", "category2Id", "childAsin");

-- CreateIndex
CREATE INDEX "ProductClassification_category2Id_month_isUnmapped_idx" ON "ProductClassification"("category2Id", "month", "isUnmapped");

-- CreateIndex
CREATE UNIQUE INDEX "ProductClassification_month_category2Id_parentProductId_key" ON "ProductClassification"("month", "category2Id", "parentProductId");

-- AddForeignKey
ALTER TABLE "ProductRow" ADD CONSTRAINT "ProductRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRow" ADD CONSTRAINT "ProductRow_category2Id_fkey" FOREIGN KEY ("category2Id") REFERENCES "Category2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentProduct" ADD CONSTRAINT "ParentProduct_category2Id_fkey" FOREIGN KEY ("category2Id") REFERENCES "Category2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildToParentMap" ADD CONSTRAINT "ChildToParentMap_category2Id_fkey" FOREIGN KEY ("category2Id") REFERENCES "Category2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildToParentMap" ADD CONSTRAINT "ChildToParentMap_parentProductId_fkey" FOREIGN KEY ("parentProductId") REFERENCES "ParentProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
