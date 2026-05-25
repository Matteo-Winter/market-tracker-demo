-- CreateTable
CREATE TABLE "CompetitorSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorSnapshotItem" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "asin" TEXT NOT NULL,
    "title" TEXT,
    "brand" TEXT,
    "category" TEXT,
    "price" DOUBLE PRECISION,
    "bsr" INTEGER,
    "reviewCount" INTEGER,
    "rating" DOUBLE PRECISION,
    "asinRevenue" DOUBLE PRECISION,
    "parentRevenue" DOUBLE PRECISION,
    "asinSales" INTEGER,
    "parentSales" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorSnapshotItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorSnapshot_snapshotDate_key" ON "CompetitorSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "CompetitorSnapshot_createdAt_idx" ON "CompetitorSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "CompetitorSnapshotItem_asin_idx" ON "CompetitorSnapshotItem"("asin");

-- CreateIndex
CREATE INDEX "CompetitorSnapshotItem_snapshotId_idx" ON "CompetitorSnapshotItem"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorSnapshotItem_snapshotId_asin_key" ON "CompetitorSnapshotItem"("snapshotId", "asin");

-- AddForeignKey
ALTER TABLE "CompetitorSnapshotItem" ADD CONSTRAINT "CompetitorSnapshotItem_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CompetitorSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
