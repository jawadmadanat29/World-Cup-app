import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/domain/page-header";
import { DeadlinesEditor } from "@/components/admin/deadlines-editor";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminDeadlinesPage() {
  const deadlines = await prisma.predictionDeadline.findMany();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Deadlines & locking"
        description="Set section deadlines and lock sections manually. Per-match locks live on the Fixtures editor. The global lock buffer is in Settings."
        eyebrow="Locking"
      />
      <DeadlinesEditor deadlines={deadlines.map((d) => ({ scope: d.scope, deadline: d.deadline ? d.deadline.toISOString() : null, manualLocked: d.manualLocked }))} />
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Match predictions lock automatically at kickoff minus the buffer. Override an individual match (lock early / reopen) from the{" "}
          <Link href="/admin/fixtures" className="text-primary hover:underline">Fixtures editor</Link>.
        </CardContent>
      </Card>
    </div>
  );
}
