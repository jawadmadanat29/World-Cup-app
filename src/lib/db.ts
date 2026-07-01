import { PrismaClient } from "@prisma/client";

// Prisma client singleton — avoids exhausting connections during dev HMR.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Resolve the runtime datasource URL. Normally Prisma just uses DATABASE_URL
// (per schema.prisma). But if DATABASE_URL is unparseable — e.g. an invisible /
// look-alike character slipped in when it was pasted into the host's dashboard —
// fall back to deriving the transaction-pooler URL from DIRECT_URL (same DB,
// port 6543 + pgbouncer). That way a bad paste of one var can't take the app
// down. Returns undefined when DATABASE_URL is fine, so nothing is overridden.
function resolveDatasourceUrl(): string | undefined {
  const pooled = process.env.DATABASE_URL;
  if (pooled) {
    try {
      new URL(pooled);
      return undefined; // valid — let Prisma use DATABASE_URL as-is
    } catch {
      console.warn("[db] DATABASE_URL is unparseable; deriving pooled URL from DIRECT_URL");
    }
  }
  const direct = process.env.DIRECT_URL;
  if (direct) {
    try {
      const u = new URL(direct);
      u.port = "6543";
      u.searchParams.set("pgbouncer", "true");
      return u.toString();
    } catch {
      console.warn("[db] DIRECT_URL is also unparseable; cannot derive a datasource URL");
    }
  }
  return undefined;
}

const datasourceUrl = resolveDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
