import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

const connectionString =
  process.env.USE_DIRECT_DB === "1"
    ? process.env.DIRECT_URL
    : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("No database connection string found. Check DATABASE_URL / DIRECT_URL.");
}

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error"],
    transactionOptions: {
      maxWait: 20000,
      timeout: 120000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}