import { Flag } from "@/components/domain/flag";
import { cn } from "@/lib/utils";

interface TeamLabelProps {
  name?: string | null;
  iso?: string | null;
  shortName?: string | null;
  placeholder?: string | null;
  reverse?: boolean;
  showShort?: boolean;
  flagSize?: "sm" | "md" | "lg" | "xl";
  className?: string;
  bold?: boolean;
}

export function TeamLabel({
  name,
  iso,
  shortName,
  placeholder,
  reverse = false,
  showShort = false,
  flagSize = "md",
  className,
  bold = false,
}: TeamLabelProps) {
  if (!name) {
    return (
      <span className={cn("truncate text-sm italic text-muted-foreground", className)}>
        {placeholder || "TBD"}
      </span>
    );
  }
  return (
    <span className={cn("flex min-w-0 items-center gap-2", reverse && "flex-row-reverse", className)}>
      <Flag iso={iso} size={flagSize} title={name} />
      <span className={cn("truncate", bold && "font-semibold")}>{showShort ? shortName ?? name : name}</span>
    </span>
  );
}
