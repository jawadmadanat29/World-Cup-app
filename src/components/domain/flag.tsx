import { cn } from "@/lib/utils";
import { flagClass } from "@/lib/format";

const SIZE: Record<string, string> = {
  sm: "0.8rem",
  md: "1.1rem",
  lg: "1.5rem",
  xl: "2rem",
};

export function Flag({
  iso,
  size = "md",
  className,
  title,
}: {
  iso?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn(flagClass(iso), "shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]", className)}
      style={{ fontSize: SIZE[size] }}
      role="img"
      aria-label={title || iso || "flag"}
      title={title}
    />
  );
}
