import { Flag } from "@/components/domain/flag";
import { cn } from "@/lib/utils";
import type { TeamLite } from "@/lib/queries";

export function TeamChip({ team, correct, className }: { team: TeamLite | null; correct?: boolean; className?: string }) {
  if (!team) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
        correct ? "bg-primary/15 text-primary" : "bg-secondary",
        className,
      )}
    >
      <Flag iso={team.isoCode} size="sm" />
      {team.shortName}
    </span>
  );
}
