import { cn } from "@/lib/utils";
import type { Achievement } from "@/lib/player-stats";

// Emoji per achievement key — kept here so badges render anywhere without props.
const ICON: Record<string, string> = {
  ORACLE: "🔮",
  EXACTA: "🎯",
  HOT_STREAK: "🔥",
  UNDERDOG: "🐉",
  PERFECT_DAY: "⭐",
  CENTURION: "💯",
  SHARPSHOOTER: "🏹",
  ON_FIRE: "🌋",
  SHARP_EYE: "👁️",
};

/** Compact earned-achievement chips — shown under a player's name. */
export function AchievementBadges({ achievements, className }: { achievements: Achievement[]; className?: string }) {
  const earned = achievements.filter((a) => a.earned);
  if (earned.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {earned.map((a) => (
        <span
          key={a.key}
          title={`${a.label} — ${a.description}`}
          className="inline-flex items-center gap-1 rounded-full border bg-secondary/60 px-2 py-0.5 text-xs font-medium"
        >
          <span aria-hidden>{ICON[a.key] ?? "🏅"}</span>
          {a.label}
        </span>
      ))}
    </div>
  );
}
