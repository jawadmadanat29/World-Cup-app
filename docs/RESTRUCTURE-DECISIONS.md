# UI Restructure — Locked Decisions

Decisions agreed during the grilling session (2026-06-05). Defaults marked
**[default]** were applied without explicit sign-off and are open to veto at review.

## Scoring boundary (Q1 — explicit)
- **Remove for real**: Total goals and Total cards predictions — drop the UI inputs,
  stop capturing `totalGoalsRange` / `totalCardsRange`, and delete the
  `BONUS_TOTAL_GOALS_RANGE` / `BONUS_TOTAL_CARDS_RANGE` scoring rules + their tests/seed.
- **Add for real**: "Player to score 2+ goals" — new scorer `pickType = "MULTI"` plus a
  new scoring rule `BONUS_MULTI_SCORER` that actually awards points (admin-editable).
- Advanced match predictions are **mandatory** (see Q2), only the Bold Call is optional + non-scoring.
- Everything else in the scoring engine stays frozen.

## Advanced-prediction completeness (Q2 — explicit + delegated)
- Per match, "complete" requires: score A, score B, first-team-to-score, BTTS, clean sheet,
  **exactly 2** anytime goalscorers, **exactly 2** assist providers, **1** multi-goal player.
  Rationale: wrong scorer/assist picks carry **no penalty** in the engine, so a fixed count
  of 2 gives every player the same opportunity surface and removes hidden floor-gaming.
- **Save-as-you-go**: each field autosaves immediately; a half-done prediction still banks
  what is filled. A match reads "complete" only when all of the above are present.
- Loud "incomplete — losing points" warning + missing-field checklist. Fields scored
  independently (a 1–0 with 2 named scorers is allowed; UI soft-hints, never blocks).
- Bold Call: never required, never scored, revealed after lock with the username.

## Predictions route (Q3 — explicit)
- Repurpose `/me` → `/predictions`. Collapse 4 tabs (Matches/Groups/Tournament/Awards)
  into **2 modes**: Mode 1 Match-by-Match, Mode 2 Tournament builder. `/me` 301s to `/predictions`.
- Per-match editor stays a **separate page** (`/predictions/match/[id]`). Reuse `MatchPredictionForm` / `TournamentForm`.

## Matchday + progressive unlock (Q4 — explicit)
- **Matchday = calendar day** in a fixed tournament timezone (derived from `kickoff`; no schema change).
- **Progressive unlock**: exactly one matchday is current/open = earliest date whose matches
  aren't all locked. Earlier = done; later = new **UPCOMING** `LockState`. Next date opens when
  the current day's last match kicks off. Matchday gate sits above the existing per-match kickoff lock.

## Defaults applied (open to veto)
- **[default] Tournament timezone = America/New_York** (2026 host, US-centric). Shown explicitly in UI.
- **[default] Match lock timing**: keep the admin-configurable buffer mechanism but default the
  global buffer to **0** → effectively locks AT kickoff (honors spec §5.1, keeps admin flexibility).
- **[default] Other tournament awards** (MVP, Best Young, Best GK, first hat-trick, most-goals-match,
  surprise/disappointing/highest-scoring/best-defensive teams, ranges): **hidden** from the
  prediction UI per spec ("do not include for now"), but schema + scoring rules left **dormant**
  (not deleted, unlike Total goals/cards which were explicitly "remove"). Only Top Goalscorer +
  Top Assist survive in the builder.
- **[default] Avatars**: add `avatarId String?` to `Participant`; fixed in-repo library of generated
  (non-copyrighted) avatars. `accentColor` kept as background/fallback.
- **[default] Friend activity / latest-predictions feed**: derived from existing timestamps
  (`submittedAt`/`lockedAt`/`updatedAt`, `Wildcard.createdAt`, bold calls) — no new table unless needed.
- **[default] Admin**: keep separate admin auth (`/admin-login`); move the *entry point* into the
  profile dropdown, visible only when `isAdmin()`. Removed from main player nav.
- **[default] Privacy**: enforced server-side — other players' match picks are never sent to the client
  before that match locks; tournament picks hidden until first kickoff. Public profile + leaderboard
  feed honor this in the query layer, not just the UI.

## Build order
Spec phases 1–6, app kept compiling + `vitest` green at each phase boundary.

## Progress log
- **Phase 1 — DONE + verified** (typecheck, 39 tests). Nav simplified (nav.ts), header rebuilt
  (compact logo, profile dropdown, admin entry gated by `isAdmin()`), hydration fix
  (how-it-works:105), empty-state copy de-admin'd in 6 files, `body{overflow-x:clip}` guard.
- **Phase 2 — DONE + verified** (typecheck, 39 tests, prod build green). `Participant.avatarId`
  added + `db push`'d. Avatar library (src/lib/avatars.ts, 12 SVG faces). Signup gains avatar +
  favorite-team. Homepage redesigned (hero/ribbon/cards) via new `getHomeData`. Shared matchday
  helper (src/lib/matchday.ts, TZ = America/New_York, Intl-based, no new dep).
- **Phase 3 — IN PROGRESS.**
  - **3a DONE + verified** (typecheck, 40 tests). Scoring engine: removed `BONUS_TOTAL_GOALS_RANGE`
    + `BONUS_TOTAL_CARDS_RANGE` (engine, rules, validation, recompute, tests, dev DB rows + seed
    already build from defaults). Added `MULTI` scorer pickType + `BONUS_MULTI_SCORER` (4 pts).
    Match form reworked: mandatory "Bonus predictions" card (first-to-score, BTTS, clean sheet,
    2 anytime, 2 assists, 1 multi-goal) with N/7 completeness checklist + "losing points" warning;
    save-as-you-go (partial saves allowed, score still required); Bold Call relabelled (non-scoring);
    total goals/cards + first-goalscorer field removed from UI (first-goalscorer rule left dormant).
    `dev.db` rule rows synced; recompute run (0/0/0, pre-tournament).
  - **3c DONE + verified** (build green). Route `/me`→`/predictions` (dir moved; next.config 301
    redirects `/me`+`/me/:path*`; all internal links + auth redirects updated). Page split into
    **2 modes**: Match-by-match + Tournament (sub-tabs Groups/Bracket&winner/Top-scorer&assists,
    reusing existing forms). Per-match editor stays a separate page.
  - **3d DONE + verified.** `UPCOMING` lock state added (enums, LOCK_STATE_META, StatusBadge).
    `getPredictionHub` now matchday-grouped (calendar day, tournament TZ); current matchday =
    earliest not-fully-locked; later days render UPCOMING + non-clickable. **Server-enforced**:
    `saveMyMatchPrediction` rejects writes to future matchdays (`matchUpcoming`).
  - **3e DONE.** Wildcard now requires a confirm dialog explaining the ×2 effect before applying.
    (Bold-call *reveal-after-lock display* deferred to Phase 5/8 — data is stored already.)
  - **3g DONE.** Home "completed today" now uses full Q2 completeness (`isMatchPredictionComplete`),
    not just row-existence. Shared helper: src/lib/prediction-complete.ts.
  - **3f DONE + verified** (typecheck, 40 tests, prod build green). Guided `TournamentBuilder`
    (src/components/domain/tournament-builder.tsx): 9-step wizard — group finishes → best thirds →
    R16 → QF → SF → Final → Champion → top scorer/assist → review. **Auto-bracket**: each round's
    candidate pool derived from earlier picks (R32 qualifiers = group top-2 + chosen best thirds;
    downstream selections auto-pruned when upstream changes). Live % progress + review page flags
    missing picks; partial saves allowed; locks at TOURNAMENT deadline (server-checked). One
    orchestrating action `saveMyTournamentBuilder` (groups + bracket + 2 awards) via new query
    `getTournamentBuilderData`. Mode 2 now renders the builder (old sub-tabs removed).
  - **3f REVISED (real bracket) + verified** (typecheck, 40 tests, build green, end-to-end sim).
    Knockout is now a true single-elimination **bracket**, not a pick-N-from-pool. The R32→Final
    wiring is read from the seeded `Match` rows (placeholders `Winner X`/`Runner-up X`/`3rd Place`
    + `homeSourceMatchId`). Each tie shows **TeamA vs TeamB → pick the winner**, who advances to the
    correct next tie; downstream auto-prunes when an upstream pick changes. Teams resolve from the
    player's own picks (group winner/runner-up from the Groups step; the 8 `3rd Place` slots
    auto-filled from the best-third picks in order — assignment doesn't affect scoring). Scoring
    unchanged: advancing set per round (R32 winners→R16-reaching, etc.) = exactly what the engine
    scores. Builder steps: Groups → Best thirds → R32 → R16 → QF → SF → Final(champion) → top
    players → review. New `KoSlot`/`KoTie` types + `parseKnockout` in queries.ts; existing saved
    picks reconstructed back into per-tie winners on load.
  - **PHASE 3 COMPLETE.** Note: standalone `/predictions/group/[groupId]` page still exists and
    works (now somewhat redundant with the builder's Groups step) — harmless, revisit in Phase 6.
    `TournamentForm`/`AwardsForm` admin components now unused by the player flow (dead-code check Phase 6).
- **Phase 3 remaining TODO:**
  - rename route `/me` → `/predictions` (301 old), 4 tabs → 2 modes; per-match stays separate page.
  - mandatory advanced fields (Q2): exactly 2 anytime scorers, 2 assists, 1 multi-goal, first-to-score,
    BTTS, clean sheet; save-as-you-go; completeness gate + checklist.
  - scoring engine edits (Q1): REMOVE `BONUS_TOTAL_GOALS_RANGE` + `BONUS_TOTAL_CARDS_RANGE` (and
    `totalGoalsRange`/`totalCardsRange` capture); ADD `MULTI` scorer pickType + `BONUS_MULTI_SCORER`
    rule (update rules.ts, engine.ts, seed, tests).
  - matchday progressive-lock UPCOMING state wired into the predictions list.
  - wildcards (3, confirm-before-use), bold calls (non-scoring, reveal after lock).
  - guided tournament builder (Mode 2): group positions → best thirds → R32…Final → champion +
    top-goalscorer/top-assist only; auto-bracket from group picks; review page.
  - tighten home "completed today" to full Q2 completeness.
- **Phase 4 — DONE + verified** (typecheck, 40 tests, prod build, route smoke-tests). `/tournament`
  repurposed from the old outright-predictions board into the **browsing hub** (spec §6): tab rail
  Matches · Groups · Round of 32 · Round of 16 · QF · SF · Final.
  - Matches tab: client matchday switcher (`tournament-matches.tsx`) — recent-results strip, day rail
    (defaults to current matchday, dot marker), "All matches" view. Reuses `FixtureCard`.
  - Groups tab: reuses `GroupTable` (P/W/D/L/GF/GA/GD/Pts + qualification highlight).
  - Knockout tabs: responsive **per-round** view (`knockout-round.tsx` `KnockoutRound`/`TieCard`) —
    one round at a time (mobile-friendly), prev/next round arrows, champion banner + third-place on
    Final. Each tie shows real teams or placeholders + scores once played.
  - Old standalone pages folded in via next.config 308s: `/fixtures`→matches, `/groups`→groups,
    `/bracket`→r32. **`/fixtures/[matchId]` detail intentionally preserved** (not redirected).
  - Old `/tournament` board query `getTournamentBoard` now unused (its content — everyone's outright
    picks — moves to public profiles in Phase 5); dead-code removal Phase 6.
- **Phase 5 — DONE + verified** (typecheck, 40 tests, prod build, privacy gate checked vs real data).
  - **Leaderboard simplified** (spec §7): rank · avatar · nickname · favorite-flag · total; logged-in
    row highlighted ("You"); whole row links to profile. Dropped the heavy filter/expand view.
  - **Latest Predictions feed** under the leaderboard via new `getLatestPredictions` — **privacy-safe**:
    match predictions + bold calls + wildcards appear ONLY after that match locks; tournament picks
    show as "submitted" with **no selections revealed**.
  - **Players list** (§8): avatar + nickname + favorite-flag + total, links to profile.
  - **Public profile** (§8) rebuilt on new `getPublicProfile` — **server-side privacy**: a player's
    match prediction (score + advanced picks + bold call + wildcard) is revealed only once that match
    locks (`isLocked(matchLockState)`); the tournament forecast (champion, finalists, round sets,
    best thirds, group finishes, top scorer/assist) only after the first kickoff (TOURNAMENT lock).
    Before lock: counts shown, contents hidden ("N hidden until kickoff").
  - Privacy verified: with today < first kickoff, **0/104 matches locked → all preds hidden**.
  - Dead after this phase (Phase 6 cleanup): `leaderboard-view.tsx`, `getParticipantProfile`.
- **Phase 6 — DONE + verified** (typecheck, 40 tests, recompute clean, prod build). ALL 6 PHASES COMPLETE.
  - **Timezone sweep**: `formatKickoff`/`formatKickoffShort` now render in the fixed tournament TZ
    (Intl, `America/New_York`) with an `ET` label — fixes every fixture/detail/header time at once,
    SSR/client consistent. Joins the home ribbon + predictions list which were already TZ-aware.
  - **Loading/error/empty states**: generic `(public)/loading.tsx` skeleton already applies to every
    public route; `app/error.tsx` + `not-found.tsx` present; empty states de-admin'd + player-centered.
  - **Dead-code removed**: `leaderboard-view.tsx` (file) + `getDashboard`/`getTournamentBoard`/
    `getParticipantProfile` query functions (all zero-reference, grep-verified).
  - **Scoring integrity confirmed**: 40 unit tests pass + full `recomputeEverything` runs without error
    (only the explicitly-requested Q1 edits changed scoring; everything else frozen).
  - Note: project lives in **iCloud Drive** → `.next` occasionally gets `"...d 2.ts"` conflict copies;
    `rm -rf .next` clears them before typecheck/build.
- **Consciously left (not blockers, document for deploy)**:
  - Sample participants (7) + sample teams/players kept so the app is reviewable populated; real
    deployment should reseed real players (spec §9 "remove obvious sample users" — deferred to deploy).
  - Orphaned-but-functional pages `/awards`, `/leaders` (stats views, not in nav) and the now-dead
    `/fixtures` `/groups` `/bracket` index page files (shadowed by redirects) left in place.
- **State**: working tree has uncommitted Phase 1–2 changes (not committed — user hasn't asked).
  DB (dev.db) already migrated for `avatarId`.
