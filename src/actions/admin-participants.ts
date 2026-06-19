"use server";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { participantSchema } from "@/lib/validation";
import { initialsOf } from "@/lib/format";
import { writeAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { SETTINGS } from "@/lib/enums";
import { revalidateEverything } from "@/lib/revalidate";

export interface ParticipantInput {
  id?: string;
  name: string;
  nickname?: string;
  accentColor?: string;
  favoriteTeamId?: string;
}

async function activeLeagueId(): Promise<string> {
  const s = await prisma.appSettings.findUnique({ where: { key: SETTINGS.ACTIVE_LEAGUE_ID } });
  if (s?.value) return s.value;
  const existing = await prisma.league.findFirst();
  if (existing) return existing.id;
  const created = await prisma.league.create({ data: { name: "Friends League", season: "2026", isActive: true } });
  return created.id;
}

export async function saveParticipant(data: ParticipantInput): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = participantSchema.safeParse(data);
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid input.");
    const { name, nickname, accentColor, favoriteTeamId } = parsed.data;
    const color = accentColor && accentColor !== "" ? accentColor : "#10b981";
    const fav = favoriteTeamId && favoriteTeamId !== "" ? favoriteTeamId : null;

    if (data.id) {
      await prisma.participant.update({
        where: { id: data.id },
        data: { name, nickname: nickname ?? null, initials: initialsOf(name), accentColor: color, favoriteTeamId: fav },
      });
      await writeAudit({ action: "UPDATE", entity: "participant", entityId: data.id, summary: `Updated participant ${name}.` });
    } else {
      const leagueId = await activeLeagueId();
      const created = await prisma.participant.create({
        data: { leagueId, name, nickname: nickname ?? null, initials: initialsOf(name), accentColor: color, favoriteTeamId: fav },
      });
      await writeAudit({ action: "CREATE", entity: "participant", entityId: created.id, summary: `Added participant ${name}.` });
    }
    revalidateEverything();
    return ok(data.id ? "Participant updated." : "Participant added.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save participant.");
  }
}

export async function deleteParticipant(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const p = await prisma.participant.findUnique({ where: { id } });
    if (!p) return fail("Participant not found.");
    await prisma.participant.delete({ where: { id } }); // cascades predictions/transactions
    await writeAudit({ action: "DELETE", entity: "participant", entityId: id, summary: `Removed participant ${p.name} and all their predictions.` });
    revalidateEverything();
    return ok(`Removed ${p.name}.`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not delete participant.");
  }
}

// Owner-only password reset — passwords are scrypt-hashed and can't be recovered,
// so a forgotten password is reset to a new temporary one the player then changes.
export async function resetParticipantPassword(id: string, newPassword: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!newPassword || newPassword.length < 6) return fail("Password must be at least 6 characters.");
    const p = await prisma.participant.findUnique({ where: { id }, select: { name: true } });
    if (!p) return fail("Participant not found.");
    await prisma.participant.update({ where: { id }, data: { passwordHash: hashPassword(newPassword) } });
    await writeAudit({ action: "UPDATE", entity: "participant", entityId: id, summary: `Reset password for ${p.name}.` });
    return ok(`Password reset for ${p.name}. Share the temporary password with them.`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not reset password.");
  }
}
