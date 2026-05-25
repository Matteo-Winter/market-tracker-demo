
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { recomputeRollups } from "../lib/import/recomputeRollupsJob";

const batchId = process.argv[2];

if (!batchId) {
  console.error("❌ Bitte batchId angeben: npx tsx scripts/recomputeRollups.ts <BATCH_ID>");
  process.exit(1);
}

recomputeRollups(batchId)
  .then(() => console.log("✅ recomputeRollups fertig"))
  .catch((e) => {
    console.error("❌ Fehler:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  