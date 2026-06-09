import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)} aria-label="World Cup Predictor 2026 home">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
        {/* Football mark */}
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5l3.2 2.3-1.2 3.7h-4l-1.2-3.7L12 7.5z" fill="currentColor" stroke="none" />
          <path d="M12 3v2.2M4.8 9l2 1.5M19.2 9l-2 1.5M7 19l1.4-2M17 19l-1.4-2" />
        </svg>
      </span>
      {!compact && (
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="text-sm font-semibold tracking-tight">World Cup Predictor</span>
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            2026 · Friends League
          </span>
        </span>
      )}
    </Link>
  );
}
