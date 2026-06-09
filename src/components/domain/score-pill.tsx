import { cn } from "@/lib/utils";

export function ScorePill({
  home,
  away,
  className,
  muted = false,
}: {
  home: number | string | null | undefined;
  away: number | string | null | undefined;
  className?: string;
  muted?: boolean;
}) {
  const has = home != null && away != null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-sm font-semibold tabular-nums",
        muted ? "bg-secondary/60 text-muted-foreground" : "bg-secondary text-foreground",
        className,
      )}
    >
      {has ? (
        <>
          <span>{home}</span>
          <span className="text-muted-foreground">–</span>
          <span>{away}</span>
        </>
      ) : (
        <span className="text-muted-foreground">v</span>
      )}
    </span>
  );
}
