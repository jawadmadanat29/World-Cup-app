# Post-launch Improvements (3 phases)

Constraint for ALL phases: **do NOT redesign the visual style.** Keep current
aesthetic, spacing, colors, component library (shadcn/Radix + Tailwind). Only
improve usability/engagement. App is deployed: push to `main` → Vercel
auto-deploys to the live custom domain. Schema changes require `prisma db push`
against Supabase (creds in local `.env`). Verify (typecheck + `npm test` +
`npm run build`) before every push. Project is in iCloud → `rm -rf .next` if
stale `"…2.ts"` conflict files break a build.

Key existing pieces to reuse (don't rebuild):
- `Countdown` (src/components/domain/countdown.tsx) — for urgency timers.
- `Movement` (src/components/domain/movement.tsx) + `getLeaderboard().movement`
  — **leaderboard ↑/↓/→ movement ALREADY EXISTS**; Phase 2 just verifies/extends.
- `getPredictionHub` (per-user progress: matchdays, matchTotals, groups,
  tournamentDone, wildcardsUsed/Max) — feeds Phase-1 summary bar + home card.
- `getLatestPredictions` (privacy-safe feed) — Phase-2 activity feed extends this.
- `isMatchPredictionComplete` (src/lib/prediction-complete.ts) — completeness.
- Lock logic: `matchLockState`/`sectionLockState`/`isLocked`; matchday grouping
  in src/lib/matchday.ts (`groupMatchdays`, `currentMatchdayKey`, TZ helpers).
- **Privacy rule (must honor in every new feature):** never reveal another
  player's match pick before that match locks, or tournament picks before first
  kickoff. See `getPublicProfile`/`getLatestPredictions` for the pattern.

---

## PHASE 1 — Usability / friction

### 1.1 Predictions page (Match-by-match) — filters + search + sticky summary
File: src/app/(public)/predictions/page.tsx (`MatchMode`/`MatchRow`) — make a
client filter wrapper, or a new client component fed by `getPredictionHub`.
- **Filter chips** (default = **Open**): Open · Today · Tomorrow · This week ·
  Locked · Completed. Derive from each match's `lockState`/`editable`/`complete`
  + `kickoff` (today/tomorrow/week in tournament TZ — use matchday `dayKey`).
- **Search box**: filter by home/away team name (client-side).
- **Sticky summary bar** at top (position: sticky): "X / N matches predicted •
  M remaining • Next lock: <Home vs Away> in <countdown>". Counts from
  `matchTotals`; next lock = earliest open match's lock time (Countdown).

### 1.2 Home page — big progress card near top
File: src/app/(public)/page.tsx + reuse `getPredictionHub` for the logged-in user
(home currently uses `getHomeData`; add the per-user progress, or call
getPredictionHub when logged in). Show: tournament prediction ✓/✗, group rankings
✓/✗ (groupsDone/12), match predictions complete count, wildcards remaining.
Primary CTA **"Continue Predictions"** → `/predictions` (deep-link to the most
useful next step if easy). Only show for logged-in users.

### 1.3 Tournament builder — "Randomize Picks"
File: src/components/domain/tournament-builder.tsx (`GroupsStep`).
Button that fills every group's 4 positions with a random permutation of that
group's teams (Fisher–Yates). Convenience only; user can adjust after. Don't
auto-randomize knockouts (they cascade from groups).

### 1.4 Match prediction — confidence selector (non-scoring)
- **Schema change**: add `confidence String?` to `ParticipantMatchPrediction`
  (values: GUESSING | UNSURE | CONFIDENT | VERY_CONFIDENT). `prisma db push`.
- Add a selector to the match form (src/components/admin/match-prediction-form.tsx),
  thread through validation (src/lib/validation.ts matchPredictionSchema) +
  write (src/lib/prediction-writes.ts) + `getMatchPrediction` existing payload.
- NON-scoring. For fun/stats only. Surface later in Phase-2 stats.

### 1.5 Urgency countdowns
Use `Countdown`. Add where relevant: predictions list ("3 matches lock today"),
summary bar ("Next lock in 4h"), tournament mode ("Tournament picks lock when the
opening match starts" + countdown to first kickoff). Compute from lock times.

---

## PHASE 2 — Competitive / social

### 2.1 Rival comparison (CORE feature)
New page e.g. `/compare?with=<participantId>` (link from leaderboard/profile/players).
New query comparing the viewer vs a chosen player. Show differences in: group
winners, group rankings, knockout bracket, champion, match predictions. Highlight
disagreements visually (e.g. colored when they differ).
**PRIVACY (critical):** only compare what's already revealed — tournament picks
only after first kickoff (both players); a match pick only after that match locks.
Before lock, show "hidden until lock" rather than the rival's pick. The viewer's
OWN picks can always show.

### 2.2 Leaderboard movement — VERIFY (mostly done)
`Movement` + `getLeaderboard().movement` already render ↑n/↓n/→. Confirm it's shown
on the leaderboard rows (it is on home preview; ensure on /leaderboard rows too)
and on profiles. Likely a small addition, not new infra.

### 2.3 Expanded activity feed
Extend `getLatestPredictions` (or a new feed query) with event types: tournament
submitted, match submitted, wildcard used (have these), PLUS: moved into 1st
(needs rank-change detection — compare snapshots or use movement), exact score
achieved (from `PointTransaction` source=MATCH_EXACT), tournament prediction
completed. Keep privacy-safe (no pick contents pre-lock).

### 2.4 Player statistics (on profiles)
Profile (`getPublicProfile`) already has exactScores, correctOutcomes via
`LeaderboardStats`. ADD: prediction accuracy % (correct outcomes / scored matches),
best matchday (max points in one matchday), worst matchday, wildcards used,
current streak (consecutive correct outcomes). Streak/matchday need computation
from `PointTransaction` grouped by match→matchday. Show in a stats card.

### 2.5 Achievements / badges (cosmetic, no scoring)
Compute from existing data; display on profile (+ maybe a small row on leaderboard).
Badges: Oracle (champion correct — after final), Exacta (5 exact scores),
Hot Streak (5 correct outcomes in a row), Underdog Hunter (correct major upset —
define: predicted the lower-ranked/away winner correctly, or pick a heuristic),
Perfect Day (all results correct on a matchday). Pure cosmetic. New
`computeAchievements(participantId)` helper from PointTransaction + predictions.

---

## PHASE 3 — Scoring clarity (preserve depth)

Source of truth: src/lib/scoring/rules.ts (DEFAULT_SCORING_RULES) + engine.ts.
Changing a rule value is low-risk (admin-editable, recompute handles it). Removing
a category touches engine + tests + the relevant prediction UI.

### 3.1 Evaluate / simplify these (recommend + implement)
Review for casual friends:
- **Assist provider predictions** — KEEP (core-ish, already mandatory). Lean keep.
- **Hat-trick range** (TOURNAMENT_HATTRICK_RANGE) — RECOMMEND REMOVE (niche, noisy).
- **Red-card range** (TOURNAMENT_RED_CARD_RANGE) — RECOMMEND REMOVE.
- **Tournament goal range** (TOURNAMENT_TOTAL_GOALS_RANGE) — RECOMMEND REMOVE.
These three tournament *range* extras add complexity for little fun. They are
already HIDDEN from the new builder UI (only champion/finalists/rounds/best-thirds
+ top scorer/assist are collected), so removing their *scoring rules* + the
dormant fields is low-risk cleanup. Confirm with user before deleting rules;
otherwise leave dormant (they currently never score since the builder doesn't
collect them).

### 3.2 Keep core
Match result, exact score, champion, runner-up, Golden Boot, Player of the
Tournament, Best Young Player, knockout progression. (Note: builder currently only
collects Golden Boot + Top Assist among awards; MVP/Best Young are dormant. If
keeping MVP/Best Young is desired, they must be ADDED back to the builder UI —
flag this to the user; it's a scope decision.)

### 3.3 Champion weighting 25 → 30
src/lib/scoring/rules.ts: `KO_PRE_CHAMPION` value `25` → `30`. Also update the dev
+ Supabase ScoringRule row (UPDATE) and run recompute. One-line + data sync.

### 3.4 30-second scoring summary
Add a simple, scannable summary at the top of /scoring (src/app/(public)/scoring/
page.tsx) — a few lines a new player grasps fast (e.g. "Right result +3, exact
score +7, group finishes, reach each knockout round, champion +30, Golden Boot,
plus fun bonuses"). Keep the detailed table below for those who want it.

---

## Suggested execution order
Phase 1 first (pure usability, mostly UI + one tiny schema field). Then Phase 3
(small, clarifying — champion bump + summary + optional range removals). Then
Phase 2 (largest — comparison, stats, achievements). Confirm the Phase-3 removals
and the MVP/Best-Young question with the user before deleting/adding scoring.
