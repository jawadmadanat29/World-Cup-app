"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, normalizeLoginName, startUserSession, endUserSession } from "@/lib/auth";
import { initialsOf } from "@/lib/format";
import { SETTINGS } from "@/lib/enums";
import { getAvatar } from "@/lib/avatars";

export interface AuthState {
  error?: string;
}

const ACCENTS = ["#10b981", "#f59e0b", "#38bdf8", "#a78bfa", "#fb7185", "#34d399", "#f472b6", "#60a5fa", "#22d3ee", "#f87171"];

async function activeLeagueId(): Promise<string> {
  const s = await prisma.appSettings.findUnique({ where: { key: SETTINGS.ACTIVE_LEAGUE_ID } });
  if (s?.value) return s.value;
  const existing = await prisma.league.findFirst();
  if (existing) return existing.id;
  const created = await prisma.league.create({ data: { name: "Friends League", season: "2026", isActive: true } });
  return created.id;
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim();
  const avatar = getAvatar(String(formData.get("avatarId") ?? "")); // null if unset/invalid
  const favoriteTeamId = String(formData.get("favoriteTeamId") ?? "").trim() || null;

  if (name.length < 2 || name.length > 40) return { error: "Name must be 2–40 characters." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  const loginName = normalizeLoginName(name);
  const existing = await prisma.participant.findUnique({ where: { loginName } });
  if (existing) return { error: "That name is taken. Try another (or sign in)." };

  // Validate the favourite team id against the real team table (ignore if bogus).
  const team = favoriteTeamId ? await prisma.team.findUnique({ where: { id: favoriteTeamId }, select: { id: true } }) : null;

  const leagueId = await activeLeagueId();
  // Keep the accent colour aligned with the chosen avatar's jersey for a
  // consistent fallback; otherwise pick a random accent.
  const accentColor = avatar?.shirt ?? ACCENTS[Math.floor(Math.random() * ACCENTS.length)];
  const created = await prisma.participant.create({
    data: {
      leagueId,
      name,
      nickname: nickname || null,
      initials: initialsOf(name),
      accentColor,
      avatarId: avatar?.id ?? null,
      favoriteTeamId: team?.id ?? null,
      loginName,
      passwordHash: hashPassword(password),
      lastLoginAt: new Date(),
    },
  });
  await startUserSession(created.id);
  redirect("/predictions");
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name || !password) return { error: "Enter your name and password." };

  const participant = await prisma.participant.findUnique({ where: { loginName: normalizeLoginName(name) } });
  if (!participant || !verifyPassword(password, participant.passwordHash)) {
    return { error: "Wrong name or password." };
  }
  await prisma.participant.update({ where: { id: participant.id }, data: { lastLoginAt: new Date() } });
  await startUserSession(participant.id);
  redirect("/predictions");
}

export async function logoutUser(): Promise<void> {
  await endUserSession();
  redirect("/");
}
