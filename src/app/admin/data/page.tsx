import { PageHeader } from "@/components/domain/page-header";
import { DataTools } from "@/components/admin/data-tools";

export const dynamic = "force-dynamic";

export default function AdminDataPage() {
  return (
    <div>
      <PageHeader title="Import / export" description="Back up everything as JSON, export CSVs, and import official teams or fixtures to replace the sample data." eyebrow="Data" />
      <DataTools />
    </div>
  );
}
