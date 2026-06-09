import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Movement({ value, className }: { value: number; className?: string }) {
  if (value > 0)
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold text-teal", className)} title={`Up ${value}`}>
        <ArrowUp className="h-3 w-3" />
        {value}
      </span>
    );
  if (value < 0)
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold text-destructive", className)} title={`Down ${-value}`}>
        <ArrowDown className="h-3 w-3" />
        {-value}
      </span>
    );
  return (
    <span className={cn("inline-flex items-center text-muted-foreground", className)} title="No change">
      <Minus className="h-3 w-3" />
    </span>
  );
}
