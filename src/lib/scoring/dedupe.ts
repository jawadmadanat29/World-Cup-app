import type { Award } from "./engine";

/**
 * Stable, unique key for a single awarded fact. Guarantees a participant can't
 * be scored twice for the same thing (enforced by a UNIQUE index on
 * PointTransaction.dedupeKey). `scopeId` is the match/group id, "tournament",
 * or an award type; `ref` disambiguates per-player/per-team awards.
 */
export function buildDedupeKey(participantId: string, scopeId: string, award: Award): string {
  return [participantId, scopeId, award.source, award.ref ?? ""].join("|");
}
