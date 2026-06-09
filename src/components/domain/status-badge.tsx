import { Badge } from "@/components/ui/badge";
import { LOCK_STATE_META } from "@/lib/locking";
import type { LockState } from "@/lib/enums";
import { cn } from "@/lib/utils";

const TONE_TO_VARIANT: Record<string, React.ComponentProps<typeof Badge>["variant"]> = {
  open: "teal",
  warn: "warning",
  locked: "destructive",
  done: "muted",
  upcoming: "secondary",
};

const TONE_DOT: Record<string, string> = {
  open: "bg-teal",
  warn: "bg-warning",
  locked: "bg-destructive",
  done: "bg-muted-foreground",
  upcoming: "bg-muted-foreground/60",
};

export function StatusBadge({ state, className }: { state: LockState; className?: string }) {
  const meta = LOCK_STATE_META[state];
  return (
    <Badge variant={TONE_TO_VARIANT[meta.tone]} className={cn("gap-1.5", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[meta.tone])} />
      {meta.label}
    </Badge>
  );
}
