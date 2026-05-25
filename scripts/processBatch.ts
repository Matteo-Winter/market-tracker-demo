import "dotenv/config";
import { prisma } from "../lib/prisma";
import { processBatch } from "../lib/import/processBatchJob";

const batchId = process.argv[2];

if (!batchId) {
  console.error("❌ Bitte batchId angeben: npx tsx scripts/processBatch.ts <BATCH_ID>");
  process.exit(1);
}

processBatch(batchId)
  .then(() => console.log("✅ processBatch fertig"))
  .catch((e) => {
    console.error("❌ Fehler:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
