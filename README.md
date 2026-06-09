# ⚽ World Cup Predictor 2026 — Friends League

A private, multi-user prediction game for the FIFA World Cup 2026. **Friends
sign up themselves** and enter their own predictions; a configurable scoring
engine turns those into a live leaderboard, group tables, a knockout bracket,
tournament & award predictions, a Golden-Boot/assist leaders board, and fun
stats. The admin manages results & scoring (or lets the **live football API**
sync them in).

Built as a real sports product: a modern **light dashboard** (flat, no
gradients/glass; dark mode included), fully responsive with a sticky mobile nav,
accessible components, skeletons, empty states and toasts.

> **Real schedule, sample squads.** Teams, the group draw and the full 104-match
> schedule come from the official 2026 calendar (`src/data/wc2026.json`, generated
> from an `.ics`). **Player rosters are illustrative** (squads aren't in the
> calendar) — replace via Admin → Import when squads are announced.

---

## What's new (v2 — multi-user + live data)

- **Self-service accounts (open sign-up).** Friends register at **`/signup`** (name + password), sign in at **`/login`**, and enter **their own** predictions at **`/me`**. The admin never enters predictions for people. Admin signs in separately at **`/admin-login`**.
- **Two prediction modes**, both self-service & lock-gated: a **one-time tournament prediction** (group rankings → Round of 16 → QF → SF → final → champion/3rd/4th → best thirds → top scorer / assister / MVP + specials) and **match-by-match** picks for every matchday.
- **Lock rules.** Match predictions are editable until kickoff (− buffer), show "closing soon", then **lock at kickoff** — no edits after, and everyone's picks are revealed **only after lock**. Tournament/group sections lock at their deadlines.
- **Public, read-only views.** Anyone can see the leaderboard, the **live-match comparison** (outcome %s, popular score/scorer), the **Leaders** board (Golden Boot race, assists, hat-tricks, team stats — auto-computed), and a **"How scoring works"** page.
- **Live football API sync** — optional, provider-agnostic (API-Football shape). One shared server-side sync (never per visitor); admin **Sync console** with status/quota/last-error/retry; a **`/api/sync`** endpoint for cron. **Manual results always win** over the API, and the site is fully DB-driven so it never breaks if the API is down.
- **Backup / restore & testing mode** — full JSON backup + one-click restore, plus "load sample results", "clear results" and "reset predictions" for safe rehearsal before kickoff.

---

## 1. What was built

**Reliable MVP (all flows complete — no stubbed critical paths):**

- **Auth** — open self-signup for players (name + password) and a separate admin password; signed httpOnly cookies, enforced by middleware and re-checked inside every mutation.
- **Self-service predictions** — each player enters their own **match**, **group ranking**, **tournament bracket** and **award** picks at `/me` (advanced match picks collapsible). Lock-gated; the admin can manage but doesn't enter for people.
- **Participants** — admin CRUD with avatar initials, accent colour, nickname, favourite team (alongside self-signup).
- **Results entry** — 90'/ET/penalty scores, advancing team, goalscorers, assists, own/penalty goals, cards — or auto-synced from the live API. Saving **recalculates every affected prediction** and the leaderboard automatically.
- **Configurable scoring engine** — every point value and bonus toggle is editable in the admin. Idempotent, transparent `point_transactions` with a human reason and a unique dedupe key. Manual admin adjustments are stored separately and survive recalculation.
- **Leaderboard** — live ranking with real **rank movement**, category filters (match / group / knockout / tournament / awards / wildcards) and an expandable per-participant breakdown. Full tiebreaker chain.
- **Groups** — automated standings (P/W/D/L/GF/GA/GD/Pts), qualification highlighting, best third-place ranking.
- **Knockout bracket** — responsive R32 → Final with champion banner; teams populate from the resolved group stage.
- **Fixtures** — all 104 matches with stage/status/group/team filters and search; lock-state badges (Open / Closing soon / Locked / Completed).
- **Deadlines & locking** — per-match auto-lock at kickoff − buffer, section deadlines, manual lock/unlock overrides, all audit-logged.
- **Match detail** — events timeline, **consensus** (% outcomes, top score, popular scorer, wildcards) and everyone's predictions **revealed only after lock** (hidden before, to prevent copying).
- **Import / export** — JSON backup of all data, leaderboard & scoring CSVs, JSON import for teams and fixtures, with templates.
- **Audit log** — timestamped record of every admin change.
- **Unit tests** — 39 tests covering the scoring engine, standings, best-third ranking, tiebreakers, ranges and the leaders aggregator.

**Documented limitations / next steps:** see [section 10](#10-limitations--recommended-next-improvements).

---

## 2. Folder structure

```
world-cup-predictor-app/
├─ prisma/
│  ├─ schema.prisma          # full relational model (SQLite locally, Postgres-portable)
│  └─ seed.ts                # builds the league from the central data + sample predictions
├─ src/
│  ├─ data/
│  │  └─ tournament-data.ts  # SINGLE source of truth: teams, venues, groups, fixtures, players
│  ├─ lib/
│  │  ├─ db.ts               # Prisma client singleton
│  │  ├─ auth.ts / auth-token.ts   # admin session (cookie + edge-safe HMAC)
│  │  ├─ locking.ts          # lock-state + status-badge logic
│  │  ├─ settings.ts         # app settings accessor
│  │  ├─ queries.ts          # all read-side data loaders for pages
│  │  ├─ validation.ts       # Zod schemas (shared with forms)
│  │  ├─ enums.ts, format.ts, audit.ts, revalidate.ts, action-result.ts, nav.ts
│  │  └─ scoring/
│  │     ├─ engine.ts            # PURE scoring functions
│  │     ├─ rules.ts             # default scoring rules (also seeded & editable)
│  │     ├─ standings.ts         # group tables + best-third ranking
│  │     ├─ tiebreakers.ts       # leaderboard ordering
│  │     ├─ ranges.ts, dedupe.ts
│  │     ├─ recompute-core.ts    # idempotent transaction writer (takes a Prisma client)
│  │     ├─ recompute.ts         # server wrapper around the core
│  │     └─ *.test.ts            # Vitest unit tests
│  ├─ actions/               # server actions (auth, participants, results, predictions, scoring, settings, deadlines, fixtures, data)
│  ├─ components/
│  │  ├─ ui/                 # shadcn primitives (button, dialog, select, tabs, toast…)
│  │  ├─ layout/             # header, mobile nav, theme toggle, logo
│  │  ├─ domain/             # FixtureCard, GroupTable, Bracket, LeaderboardView, flags, score pills…
│  │  └─ admin/              # entry forms, editors, managers
│  ├─ app/
│  │  ├─ (public)/           # dashboard, fixtures, groups, bracket, tournament, awards, leaderboard, participants, login
│  │  ├─ admin/              # overview, predictions, results, participants, fixtures, scoring, deadlines, data, audit, settings
│  │  ├─ api/export/         # JSON/CSV export endpoint (admin-only)
│  │  ├─ layout.tsx, providers.tsx, globals.css, error.tsx, not-found.tsx
│  └─ middleware.ts          # protects /admin
├─ .env.example, .env
├─ package.json, tsconfig.json, tailwind.config.ts, postcss.config.mjs, next.config.ts, vitest.config.ts, components.json
```

---

## 3. Database schema overview

A clean relational schema (UUID primary keys). Highlights:

- **Identity / league:** `User` (ready for future per-participant login), `League`, `LeagueMember`, `Participant`.
- **Tournament structure:** `Team`, `Group`, `GroupMember`, `Venue`, `Player`, `Match` (with knockout placeholders + bracket feeder wiring), `MatchResult`, `MatchEvent` (goals/assists/cards as typed events).
- **Predictions:** `ParticipantMatchPrediction` (+ `…ScorerPrediction`), `ParticipantGroupPrediction`, `ParticipantKnockoutPrediction`, `ParticipantTournamentPrediction` (+ `…TeamPick`), `ParticipantAwardPrediction`.
- **Actuals:** `TournamentResult` (singleton), `AwardResult`.
- **Scoring:** `ScoringRule` (configurable values/toggles), `PointTransaction` (transparent, idempotent, unique `dedupeKey`), `AdminAdjustment` (kept separate), `Wildcard`.
- **Ops:** `PredictionDeadline`, `AppSettings`, `AuditLog`.

The schema is written to be **Postgres-portable**: no DB-level enums (String + Zod) and no array columns (join tables), so the only change needed to move to Supabase Postgres is the datasource (see section 5).

---

## 4. Run locally (exact commands)

Requires **Node 18+** (built/tested on Node 22/26). No Docker, no cloud — local SQLite.

```bash
# 1. install dependencies (also generates the Prisma client)
npm install

# 2. create your env file
cp .env.example .env

# 3. create the local database and load sample data
npm run setup          # = prisma generate + db push + seed
#    (or run individually: npm run db:push  &&  npm run db:seed)

# 4. start the dev server
npm run dev            # http://localhost:3000
```

Other scripts:

```bash
npm run build          # production build
npm run start          # run the production build
npm run lint           # ESLint (clean)
npm run typecheck      # tsc --noEmit (clean)
npm test               # Vitest unit tests (33 passing)
npm run db:seed        # re-seed (wipes & reloads sample data)
npm run db:studio      # Prisma Studio (browse the DB)
npm run db:reset       # full reset + seed (prompts before destroying data)
```

---

## 5. Supabase / Postgres setup (deployment DB)

The app runs on SQLite locally and deploys on Supabase Postgres with a one-line datasource change.

1. Create a project at [supabase.com](https://supabase.com) → **Project Settings → Database** → copy the connection strings.
2. In `prisma/schema.prisma`, change the datasource:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")   // uncomment this line
   }
   ```
3. Set the env vars (use the **pooled** URL for `DATABASE_URL`, the **direct** URL for `DIRECT_URL`):
   ```
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   ```
4. Apply the schema and seed:
   ```bash
   npx prisma db push      # creates all tables in Supabase
   npm run db:seed         # optional: load sample data
   ```
   (For versioned migrations instead of `db push`, run `npx prisma migrate dev --name init`.)

> No Supabase-specific client code is used — just Postgres via Prisma — so nothing else changes. (Row-Level Security isn't needed: the app is admin-gated and reads are public by design.)

---

## 6. Seeding the database

`npm run db:seed` runs `prisma/seed.ts`, which:

- loads 48 teams, 16 venues, 12 groups and all 104 fixtures from `src/data/tournament-data.ts`;
- generates sample players, **completes the entire group stage** with results + events, resolves the Round of 32, and leaves knockouts open;
- creates **6 participants** with example match/group/tournament/award predictions and a few wildcards;
- runs the scoring engine so the leaderboard is populated immediately;
- adds a demo admin adjustment and an audit entry.

Kickoff times are anchored **relative to when you seed** so the app always shows a live mix of completed / locked / closing-soon / upcoming matches.

---

## 7. Deploy to Vercel

1. Push the repo to GitHub.
2. In Vercel → **New Project** → import the repo (framework auto-detected as Next.js).
3. Add environment variables (**Project Settings → Environment Variables**):
   - `DATABASE_URL` (and `DIRECT_URL`) — your Supabase strings
   - `ADMIN_PASSWORD` — a strong password
   - `AUTH_SECRET` — `openssl rand -base64 32` (signs admin **and** participant sessions)
   - *(optional, live data)* `FOOTBALL_API_KEY` (+ `FOOTBALL_API_HOST` / `FOOTBALL_API_LEAGUE` / `FOOTBALL_API_SEASON`) and `CRON_SECRET`
4. Ensure `prisma/schema.prisma` uses the `postgresql` provider (section 5). The build runs `prisma generate` automatically (`build` script + `postinstall`).
5. Deploy. After the first deploy, push the schema once: locally run `npx prisma db push` against the Supabase URL (or add a one-off `prisma migrate deploy`). Optionally seed with `npm run db:seed`.
6. *(optional)* **Schedule syncs** with Vercel Cron — add to `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/sync", "schedule": "*/10 * * * *" }] }
   ```
   Vercel Cron sends the request with your project's auth; for external schedulers send `Authorization: Bearer <CRON_SECRET>`.

---

## 8. Logging in

**Friends (players):** open **`/signup`** to create an account (name + password), then **`/login`**. They make and edit their own predictions at **`/me`**. Everyone can browse the leaderboard, fixtures, groups, bracket, leaders and scoring read-only.

**Admin:** sign in at **`/admin-login`** with `ADMIN_PASSWORD`.
- **Local default:** `worldcup2026` (set in `.env`). **Change it before deploying.**
- The admin manages results, the API sync, scoring, deadlines, participants, outcomes/awards, import/export and backups — but **never enters predictions for people**.
- Sessions are signed httpOnly cookies (7-day expiry), verified in middleware and in every mutation.

---

## 8b. Live data, backups & testing (admin)

- **API Sync** (`/admin/sync`) — with `FOOTBALL_API_KEY` set, hit **Sync now** (or let cron call `/api/sync`) to pull live scores/results. The console shows status, last/next sync, quota remaining, last error and a retry button. The API is called **only here**, never per visitor, and a slow/down API never affects the site (all reads come from the DB). Anything you enter manually in **Results** is a manual override and is **never** overwritten by a sync.
- **Backup** — **Admin → Import / Export → Download full backup (JSON)**. Keep copies; this is your safety net.
- **Restore** — paste a backup JSON into **Import / Export → Restore from backup**. It wipes and recreates in one transaction, so a bad file changes nothing. (For a clean local wipe, `npm run db:reset`.)
- **Testing mode** — **Load sample results** (simulates the group stage to test scoring/leaderboard/leaders), **Clear all results**, **Reset all predictions**. Perfect for rehearsing before 11 June.

---

## 9. Replacing sample data with official 2026 data

The teams, draw and schedule already come from the official 2026 calendar
(`src/data/wc2026.json`). To refresh or correct them:

1. **From an `.ics` calendar:** `ICS=~/Downloads/FIFA_World_Cup_2026.ics npx tsx scripts/generate-wc2026.ts` regenerates `src/data/wc2026.json`, then `npm run db:seed`.
2. **Admin UI (no code):** **Admin → Import / Export** to paste official **teams** / **fixtures** JSON (templates in-page; fixtures match on `matchNumber`, teams on `shortName`), and **Admin → Fixtures editor** to fix kickoff times, venues, and resolve knockout placeholders to real teams as rounds complete.
3. **Live API:** set `FOOTBALL_API_KEY` and let **API Sync** pull results automatically (manual entries always win).

Imported teams are marked `isSample: false` automatically. Player rosters are
generated samples — replace via the teams/players import when squads are out.

---

## 10. Limitations & recommended next improvements

**Scope notes (none block core flows):**

- **API sync covers scores/results**, not goalscorers/assists. Free/most football APIs don't expose assists, and per-fixture goal events cost extra calls/quota — so scorers, assists and MVP are entered by hand (or via Outcomes & Awards, which **auto-suggests** the Golden Boot / top assister from the goals you log). Adding an optional per-fixture events fetch is a clean follow-up.
- **Team-name matching** on sync is best-effort (normalised names + an alias map); unmatched fixtures are reported in the sync summary and entered manually.
- **Stage-by-stage knockout scoring** — schema + rule table are wired; the bracket is currently scored via the one-time tournament prediction (R16 → champion). Per-round winner scoring is the next increment.
- **Fun extras** — achievement badges, friend-vs-friend comparison and shareable image cards aren't built yet (live consensus, the Leaders board, completion tracker and league stats **are**).

**Recommended next improvements:**

- Versioned Prisma migrations (`prisma migrate`) for production instead of `db push`.
- Per-fixture goalscorer/assist sync (extra API calls) + a manual team-name → fixture mapping screen for unmatched syncs.
- Rank-history snapshots for richer "biggest movers" over time.
- Rate-limiting / lockout on login; optional email + password reset for participants.
- Achievement badges and friend-comparison views.

---

### Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui (Radix) · Lucide ·
Prisma (SQLite → Supabase Postgres) · React Hook Form-ready Zod validation ·
date-fns · Sonner toasts · Vitest.

*Generated sample rosters and the sample group draw are illustrative and must be replaced with official data before the tournament.*
