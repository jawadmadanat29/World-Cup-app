import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  className,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
  accent?: "primary" | "gold" | "teal" | "default";
}) {
  const accentColor =
    accent === "gold" ? "text-gold" : accent === "teal" ? "text-teal" : accent === "primary" ? "text-primary" : "text-foreground";
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className={cn("mt-2 text-2xl font-bold tabular-nums", accentColor)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
