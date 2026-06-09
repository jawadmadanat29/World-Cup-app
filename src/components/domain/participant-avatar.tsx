import Link from "next/link";
import { cn } from "@/lib/utils";
import { getAvatar, type AvatarDef } from "@/lib/avatars";
import { flagClass } from "@/lib/format";

interface AvatarProps {
  initials: string;
  color?: string | null;
  avatarId?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
};

/** Stylised, original "emoji-style" face drawn from the avatar's colour data. */
function AvatarFace({ av }: { av: AvatarDef }) {
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" role="img" aria-hidden>
      <circle cx="20" cy="20" r="20" fill={av.shirt} />
      <circle cx="20" cy="17" r="11" fill={av.skin} />
      <path d="M9,17 a11,11 0 0,0 22,0 z" fill={av.hair} />
      <circle cx="16" cy="18.5" r="1.3" fill="#1c1c1c" />
      <circle cx="24" cy="18.5" r="1.3" fill="#1c1c1c" />
      <path d="M16,22 q4,3 8,0" stroke="#1c1c1c" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function ParticipantAvatar({ initials, color, avatarId, size = "md", className }: AvatarProps) {
  const av = getAvatar(avatarId);
  if (av) {
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", SIZES[size], className)} aria-hidden>
        <AvatarFace av={av} />
      </span>
    );
  }
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", SIZES[size], className)}
      style={{ backgroundColor: color || "#10b981" }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Small country flag chip used beside a player's name (favourite team, §4). */
export function FavoriteFlag({ iso, className }: { iso?: string | null; className?: string }) {
  if (!iso) return null;
  return <span className={cn("fi inline-block h-3 w-4 rounded-[2px] align-middle", flagClass(iso), className)} aria-hidden />;
}

export function ParticipantBadge({
  id,
  name,
  nickname,
  initials,
  color,
  avatarId,
  favoriteIso,
  href,
  size = "md",
  subtitle,
}: {
  id?: string;
  name: string;
  nickname?: string | null;
  initials: string;
  color?: string | null;
  avatarId?: string | null;
  favoriteIso?: string | null;
  href?: string;
  size?: "sm" | "md" | "lg";
  subtitle?: string;
}) {
  const inner = (
    <span className="flex min-w-0 items-center gap-2.5">
      <ParticipantAvatar initials={initials} color={color} avatarId={avatarId} size={size} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium">{name}</span>
          <FavoriteFlag iso={favoriteIso} />
        </span>
        {(subtitle || nickname) && (
          <span className="truncate text-xs text-muted-foreground">{subtitle ?? `“${nickname}”`}</span>
        )}
      </span>
    </span>
  );
  if (href || id) {
    return (
      <Link href={href ?? `/participants/${id}`} className="transition-opacity hover:opacity-80">
        {inner}
      </Link>
    );
  }
  return inner;
}
