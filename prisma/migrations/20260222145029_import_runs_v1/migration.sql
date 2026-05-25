-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN     "runId" TEXT;

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "mainCategoryId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunCategory2" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "category2Id" TEXT NOT NULL,
    "activeBatchId" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'MISSING',
    "lastProcessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunCategory2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportRun_month_idx" ON "ImportRun"("month");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRun_mainCategoryId_month_key" ON "ImportRun"("mainCategoryId", "month");

-- CreateIndex
CREATE INDEX "RunCategory2_runId_idx" ON "RunCategory2"("runId");

-- CreateIndex
CREATE INDEX "RunCategory2_category2Id_idx" ON "RunCategory2"("category2Id");

-- CreateIndex
CREATE INDEX "RunCategory2_activeBatchId_idx" ON "RunCategory2"("activeBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "RunCategory2_runId_category2Id_key" ON "RunCategory2"("runId", "category2Id");

-- CreateIndex
CREATE INDEX "ImportBatch_runId_idx" ON "ImportBatch"("runId");

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_mainCategoryId_fkey" FOREIGN KEY ("mainCategoryId") REFERENCES "MainCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunCategory2" ADD CONSTRAINT "RunCategory2_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ImportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunCategory2" ADD CONSTRAINT "RunCategory2_category2Id_fkey" FOREIGN KEY ("category2Id") REFERENCES "Category2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
