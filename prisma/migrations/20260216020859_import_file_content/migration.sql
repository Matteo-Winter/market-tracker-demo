-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN     "month" TEXT;

-- AlterTable
ALTER TABLE "ImportFile" ADD COLUMN     "contentText" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "sizeBytes" INTEGER;
