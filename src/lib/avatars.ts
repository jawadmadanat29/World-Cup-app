// Fixed library of original, non-copyrighted avatars (spec §4). Each entry is
// just colour data; the SVG "emoji-style face" is drawn from it in
// ParticipantAvatar. No external assets, no fictional characters.

export interface AvatarDef {
  id: string;
  label: string;
  skin: string; // face fill
  hair: string; // hair cap fill
  shirt: string; // background ring / jersey colour
}

export const AVATARS: AvatarDef[] = [
  { id: "striker", label: "Striker", skin: "#f1c27d", hair: "#2b1b0e", shirt: "#10b981" },
  { id: "keeper", label: "Keeper", skin: "#ffdbac", hair: "#7a4a23", shirt: "#f59e0b" },
  { id: "winger", label: "Winger", skin: "#8d5524", hair: "#0f0f0f", shirt: "#38bdf8" },
  { id: "playmaker", label: "Playmaker", skin: "#c68642", hair: "#3b2412", shirt: "#a78bfa" },
  { id: "captain", label: "Captain", skin: "#e0ac69", hair: "#b5651d", shirt: "#fb7185" },
  { id: "sweeper", label: "Sweeper", skin: "#ffe0bd", hair: "#d6c200", shirt: "#34d399" },
  { id: "maestro", label: "Maestro", skin: "#a56a3a", hair: "#1c1c1c", shirt: "#f472b6" },
  { id: "rocket", label: "Rocket", skin: "#f1c27d", hair: "#6b3fa0", shirt: "#60a5fa" },
  { id: "wall", label: "The Wall", skin: "#8d5524", hair: "#2b1b0e", shirt: "#22d3ee" },
  { id: "spark", label: "Spark", skin: "#ffdbac", hair: "#c2410c", shirt: "#f87171" },
  { id: "fox", label: "Fox", skin: "#c68642", hair: "#e5e5e5", shirt: "#facc15" },
  { id: "comet", label: "Comet", skin: "#e0ac69", hair: "#0ea5e9", shirt: "#4ade80" },
];

export const DEFAULT_AVATAR_ID = AVATARS[0].id;

const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

export function getAvatar(id: string | null | undefined): AvatarDef | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}
