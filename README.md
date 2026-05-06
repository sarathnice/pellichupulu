# Pellichupulu

AI-powered Telugu matrimony website for `https://www.pellichupulu.ai`.

## Stack

- Next.js + React + Tailwind CSS frontend
- Cloudflare Pages for static frontend hosting
- Cloudflare Workers API
- Cloudflare D1 database
- Cloudflare R2 media storage
- Client-side WebP image compression and thumbnails before R2 upload

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

The frontend is configured with `output: "export"` for Cloudflare Pages.

## Cloudflare Setup

The Worker config is in `wrangler.toml`:

```toml
name = "pellichupulu-api"
main = "src/api/index.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]
```

Bindings included:

- D1 binding: `DB`
- D1 database: `pellichupulu-v2`
- R2 binding: `MEDIA_BUCKET`
- R2 bucket: `pellichupulu-media`
- R2 public domain: `media.pellichupulu.ai`
- Frontend URL: `https://www.pellichupulu.ai`

## Database Migration

Apply the schema:

```bash
npm run db:migrate
```

Seed demo data:

```bash
wrangler d1 execute pellichupulu-v2 --file=./seed.sql --remote
```

Demo member/admin logins are listed in `DEMO_CREDENTIALS.md`. These are prototype-only passwords and must be replaced before production launch.

If an older Cloudflare D1 database already exists with incompatible table names, use `reset-d1-database.cmd` to delete it, create a fresh D1 database, update `wrangler.toml`, and apply this project's schema.

## Deploy Worker API

```bash
npm run deploy:api
```

API routes:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/profiles`
- `POST /api/profiles`
- `GET /api/profiles/:id`
- `PUT /api/profiles/:id`
- `PUT /api/profiles/:id/visibility`
- `POST /api/requests`
- `GET /api/requests`
- `PUT /api/requests/:id`
- `POST /api/photo-access`
- `PUT /api/photo-access/:id`
- `POST /api/reports`
- `GET /api/admin/risk-flags`
- `POST /api/admin/subscription-override`
- `POST /api/match/score`
- `POST /api/chat/send`
- `GET /api/chat/:userId`
- `POST /api/upload`
- `DELETE /api/profile/:id`

## Deploy Frontend to Cloudflare Pages

```bash
npm run deploy:pages
```

For production, connect the Pages project to `www.pellichupulu.ai` and point API calls to the deployed Worker route.

## Staging Smoke Test

After deploying the Worker and Pages, apply the staging data cleanup once:

```cmd
apply-staging-migration.cmd
```

Then run:

```bash
npm run test:staging
```

Or on Windows:

```cmd
run-staging-smoke-test.cmd
```

This creates a temporary test member/profile in D1 and verifies registration, login, profile save/update, search, visibility, requests, reports, admin plan override, and risk flags.

## Pre-Production Gate (Recommended)

Use one command before every production move. It runs staging deploy, schema, seed, migrations, rate-limit cleanup, and the full smoke scenarios.

```bash
npm run test:preprod
```

On Windows:

```cmd
run-preprod-gate.cmd
```

Each run writes a report file in `outputs/`:

- `outputs/preprod-gate-report-*.md`

Only proceed to production when the report status is `PASS`.

## CI Gate (GitHub Actions)

Run the same gate from Actions using:

- `.github/workflows/preprod-gate.yml`

Required repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `STAGING_API_URL` (optional if default staging URL is fine)
- `TURNSTILE_BYPASS_TOKEN` (optional if default staging bypass token is fine)

The workflow uploads the generated gate report as an artifact.

## Three-Environment Release Flow (DEV, STAGE, PROD)

Use GitHub Actions workflow:

- `.github/workflows/release-with-gates.yml`

Manual trigger input:

- `target_env=dev`: deploy Worker to DEV (`wrangler deploy --env dev`)
- `target_env=stage`: run STAGE gate first, then deploy STAGE
- `target_env=prod`: run STAGE gate first, then deploy PROD

This enforces the same scenario gate before STAGE and PROD promotions.

Local equivalents:

```bash
npm run deploy:dev
npm run test:stage:gate
npm run deploy:stage
npm run deploy:prod
```

Required Actions secrets (same as gate workflow):

- `CLOUDFLARE_API_TOKEN_NONPROD`
- `CLOUDFLARE_API_TOKEN_PROD`
- `CLOUDFLARE_ACCOUNT_ID`
- `STAGING_API_URL`
- `TURNSTILE_BYPASS_TOKEN`

## Public Launch Cleanup

After staging tests are done and before sharing the site publicly, remove smoke-test users and duplicated test requests from D1:

```cmd
cleanup-public-test-data.cmd
```

The public search UI also hides test profiles by default, but this cleanup keeps the database tidy for launch.

## Design Notes

The UI follows the attached Pellichupulu mockup: deep maroon and purple backgrounds, gold-gradient logo treatment, pink/gold wedding palette, Telugu matrimony hero, AI match score cards, success stories, premium banner, app promotion, and trust-focused footer.

Recommended next design improvements:

- Replace SVG placeholders with a polished AI-generated or studio-shot Telugu wedding image set.
- Add motion lightly: card hover lift, hero sparkle shimmer, and progress animation for AI match score.
- Add a modern verification flow with upload status, review timeline, and admin approval states.
- Add accessible dark-on-light forms for longer profile creation steps.

## Legal Readiness Notes

Before launch, have an India-qualified lawyer review:

- Terms of Use, Privacy Policy, Community Guidelines, Refund Policy, and Grievance Officer details.
- Registration disclaimer and user consent language.
- Photo/video upload consent, private photo access rules, and misuse reporting.
- Data retention, deletion, correction, grievance, and user account closure flows.
- Rules for fake profiles, harassment, illegal content, user-generated content, and law-enforcement requests.

The registration flow includes a required disclaimer checkbox, but it should not be treated as a replacement for full legal documents.
