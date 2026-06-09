import "server-only";
import { prisma } from "@/lib/db";

export async function writeAudit(entry: {
  actor?: string;
  action: string;
  entity: string;
  entityId?: string;
  summary: string;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actor: entry.actor ?? "admin",
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      before: entry.before !== undefined ? JSON.stringify(entry.before) : null,
      after: entry.after !== undefined ? JSON.stringify(entry.after) : null,
    },
  });
}
