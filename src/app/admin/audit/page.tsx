import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/domain/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/domain/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 250 });
  return (
    <div>
      <PageHeader title="Audit log" description="A timestamped record of every admin change — results, predictions, scoring, locks and imports." eyebrow="Accountability" />
      {logs.length ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{l.createdAt.toLocaleString()}</TableCell>
                  <TableCell><Badge variant="muted">{l.action}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.entity}</TableCell>
                  <TableCell className="text-sm">{l.summary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <EmptyState title="No activity yet" description="Admin actions will be logged here." />
      )}
    </div>
  );
}
