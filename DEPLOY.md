# Deploy — World Cup Predictor (free, for friends)

Goal: get the app live on a free `*.vercel.app` URL so friends can sign up and
submit their **tournament bracket before the first kickoff** (it locks then).

Stack (all free): **GitHub** (code) → **Supabase** (Postgres DB) → **Vercel** (hosting).
Football API is optional and can be added later — the app works fully with manual
result entry.

> ⏰ Deadline: tournament/bracket picks lock at the first kickoff. Get friends
> signed up and bracketed BEFORE then. Match-by-match picks continue all tournament.

---

## Secrets (generated for you — keep private)
```
AUTH_SECRET=yXYIeWJtydyVrU6FjOsBBV8L3Yuvc/j9zXGtm3BsW60=
CRON_SECRET=9OgVNjiFOaEAKA9U17F2vc33AAFYufyB
ADMIN_PASSWORD=<choose your own — don't reuse the default>
```

---

## Step 1 — Put the code on GitHub
```bash
git init
git add -A
git commit -m "World Cup Predictor — initial"
# create an EMPTY repo on github.com (no readme), then:
git remote add origin https://github.com/<you>/world-cup-predictor.git
git branch -M main
git push -u origin main
```

## Step 2 — Create the database (Supabase)
1. supabase.com → New project. Pick a region near you. **Save the DB password.**
2. Project → **Connect** → "ORMs/Prisma". Copy the two strings:
   - **Pooled** (port `6543`, has `pgbouncer=true`) → `DATABASE_URL`
   - **Direct** (port `5432`) → `DIRECT_URL`

## Step 3 — Switch Prisma to Postgres
In `prisma/schema.prisma`:
```prisma
datasource db {
  provider  = "postgresql"   // was "sqlite"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")   // uncomment this line
}
```
> From here the app uses ONE cloud database for both local dev and production —
> no more local SQLite. (Ask Claude to flip this for you if you prefer.)

## Step 4 — Create + fill the tables (run once, locally)
Put the Supabase strings in your local `.env`:
```
DATABASE_URL="postgresql://...6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...5432/postgres"
AUTH_SECRET="...(from above)"
ADMIN_PASSWORD="...(your choice)"
```
Then:
```bash
npx prisma db push        # creates all tables in Supabase
npm run db:seed           # loads teams, groups, 104 fixtures, scoring rules, deadlines
```
Tip: `npx prisma studio` opens a browser view of your live DB to confirm data.

## Step 5 — Deploy on Vercel
1. vercel.com → Add New → Project → import the GitHub repo.
2. **Environment Variables** (Production): add
   `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`, `CRON_SECRET`.
   (Leave `FOOTBALL_API_KEY` empty for now = manual mode.)
3. Deploy. You get `https://<name>.vercel.app`.

## Step 6 — Smoke-test the live app
- Sign up (avatar + favorite team) → land on Predictions.
- Tournament mode → fill a bracket → save. Match mode → predict a matchday-1 game.
- Visit `/admin` after signing in at `/admin-login` (your `ADMIN_PASSWORD`).
- Leaderboard / Players / a profile load.

## Step 7 — Invite friends
Share the `vercel.app` URL. Each friend signs up and **must finish their bracket
before the first kickoff** (it locks automatically — the seed set the deadline).

---

## Optional, later — live scores (free football API)
1. dashboard.api-football.com → free plan → copy API key (100 requests/day).
2. Vercel env: `FOOTBALL_API_KEY=<key>` (host/league/season already default to
   World Cup 2026). Redeploy.
3. Admin → **API Sync** → run a sync; verify team names match your data.
4. Add a **Vercel Cron** (Project → Settings → Cron Jobs) hitting
   `GET /api/sync` with header `Authorization: Bearer <CRON_SECRET>`, only as
   often as the free quota allows (e.g. every 15 min during match days).
- Fallback: if the API has no 2026 data or you hit the cap, enter results in
  Admin → Results by hand. The app never depends on the API.

## Optional, later — custom domain
Vercel → Project → Domains → add your domain → set the DNS records Vercel shows.
Skip entirely to stay $0; the `vercel.app` URL works identically.

---

## Notes
- iCloud quirk: this project syncs via iCloud, which makes `.next` collect
  `"…2.ts"` conflict files. If a local typecheck/build acts up, `rm -rf .next`.
- Free Supabase pauses after ~7 days idle — fine during an active tournament,
  just open the app to wake it.
