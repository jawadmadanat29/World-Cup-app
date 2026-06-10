import { z } from "zod";
import {
  OUTCOMES,
  FIRST_TO_SCORE,
  CONFIDENCE_LEVELS,
  EVENT_TYPES,
  AWARD_TYPES,
  DECISIVE_SCORE,
  MATCH_STATUS,
} from "@/lib/enums";

const tuple = <T extends readonly string[]>(arr: T) => [...arr] as unknown as [string, ...string[]];

/** Optional non-negative int that treats "" / null / undefined as absent. */
const optInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().min(0).max(99).optional(),
);

const optBool = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v === true || v === "true" || v === "on"),
  z.boolean().optional(),
);

const optStr = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional(),
);

// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const participantSchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
  nickname: optStr,
  accentColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/, "Use a hex color like #10b981")
    .optional()
    .or(z.literal("")),
  favoriteTeamId: optStr,
});
export type ParticipantInput = z.infer<typeof participantSchema>;

export const matchPredictionSchema = z.object({
  participantId: z.string().min(1),
  matchId: z.string().min(1),
  homeGoals: optInt,
  awayGoals: optInt,
  advanceTeamId: optStr,
  predictExtraTime: optBool,
  predictPenalties: optBool,
  penaltyHome: optInt,
  penaltyAway: optInt,
  firstTeamToScore: z.enum(tuple(FIRST_TO_SCORE)).optional().or(z.literal("")),
  bttsPrediction: optBool,
  cleanSheetPrediction: optBool,
  firstScorerPlayerId: optStr,
  anytimeScorerPlayerIds: z.array(z.string()).max(2, "Max 2 any-time scorers").default([]),
  assistPlayerIds: z.array(z.string()).max(2, "Max 2 assist providers").default([]),
  multiScorerPlayerIds: z.array(z.string()).max(1, "Pick one multi-goal scorer").default([]),
  wildcardPick: optStr,
  confidence: z.enum(tuple(CONFIDENCE_LEVELS)).optional().or(z.literal("")),
  applyWildcard: z.boolean().default(false),
});
export type MatchPredictionInputForm = z.infer<typeof matchPredictionSchema>;

export const groupPredictionSchema = z.object({
  participantId: z.string().min(1),
  groupId: z.string().min(1),
  // teamIds ordered 1st..4th
  order: z.array(z.string().min(1)).length(4, "Rank all four teams"),
});
export type GroupPredictionInputForm = z.infer<typeof groupPredictionSchema>;

export const tournamentPredictionSchema = z.object({
  participantId: z.string().min(1),
  championTeamId: optStr,
  runnerUpTeamId: optStr,
  thirdTeamId: optStr,
  fourthTeamId: optStr,
  semifinalistTeamIds: z.array(z.string()).max(4).default([]),
  quarterfinalistTeamIds: z.array(z.string()).max(8).default([]),
  roundOf16TeamIds: z.array(z.string()).max(16).default([]),
  bestThirdTeamIds: z.array(z.string()).max(8).default([]),
  surpriseTeamId: optStr,
  disappointingTeamId: optStr,
  highestScoringTeamId: optStr,
  bestDefensiveTeamId: optStr,
  totalGoalsRange: optStr,
  finalPenaltyShootout: optBool,
  redCardRange: optStr,
  hatTrickRange: optStr,
});
export type TournamentPredictionInputForm = z.infer<typeof tournamentPredictionSchema>;

export const awardPredictionSchema = z.object({
  participantId: z.string().min(1),
  awardType: z.enum(tuple(AWARD_TYPES)),
  playerId: optStr,
  teamId: optStr,
  value: optStr,
});
export type AwardPredictionInputForm = z.infer<typeof awardPredictionSchema>;

export const matchEventSchema = z.object({
  type: z.enum(tuple(EVENT_TYPES)),
  teamId: optStr,
  playerId: optStr,
  minute: optInt,
  relatedPlayerId: optStr,
});

export const resultEntrySchema = z.object({
  matchId: z.string().min(1),
  ftHome: z.coerce.number().int().min(0).max(99),
  ftAway: z.coerce.number().int().min(0).max(99),
  wentToExtraTime: z.boolean().default(false),
  aetHome: optInt,
  aetAway: optInt,
  wentToPenalties: z.boolean().default(false),
  pensHome: optInt,
  pensAway: optInt,
  advancingTeamId: optStr,
  decisiveScore: z.enum(tuple(DECISIVE_SCORE)).default("FT"),
  mvpPlayerId: optStr,
  status: z.enum(tuple(MATCH_STATUS)).default("COMPLETED"),
  events: z.array(matchEventSchema).default([]),
});
export type ResultEntryInput = z.infer<typeof resultEntrySchema>;

export const scoringRuleUpdateSchema = z.object({
  rules: z.array(
    z.object({
      key: z.string().min(1),
      value: z.coerce.number().int(),
      enabled: z.boolean(),
    }),
  ),
});

export const settingsSchema = z.object({
  matchLockBufferMinutes: z.coerce.number().int().min(0).max(240),
  closingSoonMinutes: z.coerce.number().int().min(0).max(1440),
  wildcardsPerParticipant: z.coerce.number().int().min(0).max(20),
  tournamentName: z.string().min(1).max(80),
});

export const adjustmentSchema = z.object({
  participantId: z.string().min(1),
  points: z.coerce.number().int(),
  reason: z.string().min(1, "A reason is required for the audit log").max(200),
});

export const deadlineSchema = z.object({
  scope: z.string().min(1),
  deadline: optStr, // ISO string or empty
  manualLocked: z.boolean().default(false),
});
