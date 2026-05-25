-- AlterTable
ALTER TABLE "Category2" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ImportFile" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ImportRun" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MainCategory" ADD COLUMN     "deletedAt" TIMESTAMP(3);
