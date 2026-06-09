import "server-only";
import { prisma } from "@/lib/db";
import * as core from "@/lib/scoring/recompute-core";

// Thin server-side wrappers binding the shared recompute core to the Prisma
// singleton. Server actions import from here; the seed script calls the core
// directly with its own client.

export const recomputeMatches = () => core.recomputeMatches(prisma);
export const recomputeGroups = () => core.recomputeGroups(prisma);
export const recomputeTournamentAndAwards = () => core.recomputeTournamentAndAwards(prisma);
export const recomputeEverything = () => core.recomputeEverything(prisma);
