-- AlterTable
ALTER TABLE "ImportRun" ADD COLUMN     "compareToRunId" TEXT;

-- CreateIndex
CREATE INDEX "ImportRun_compareToRunId_idx" ON "ImportRun"("compareToRunId");

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_compareToRunId_fkey" FOREIGN KEY ("compareToRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
