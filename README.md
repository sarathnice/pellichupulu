# PELLICHUPULU v2.3

Cloudflare-native Telugu matrimony platform with React frontend, Hono Worker API, D1 database, and R2 media storage.

## Current Feature Coverage

### Core platform
- User model supports Google OAuth linkage (`google_id`), referral fields, role/status controls.
- Deep profile schema for Telugu + NRI use cases (cultural, professional, location, lifestyle, partner preferences).
- D1 schema includes analytics views: `active_profiles`, `match_stats`.

### AI video suite
- Client-side processing: face detection, optional background handling, caption generation, video compression.
- 30-second limit and file constraints validated before upload.
- Worker handles upload to R2 and stores `video_intro_url`, `video_thumbnail_url` in profiles.
- Successful video upload upgrades profile verification level to video-verified.

### Matching / messaging / moderation / monetization scaffolding
- `connections`, `messages`, `blocks_reports`, `notifications`, `subscriptions`, `payments`, `admin_logs` tables are in place.
- `user_preferences` supports discovery filters (including visa status and verification/premium filters).

## Deployment
1. Install dependencies: `npm install`
2. Apply DB migrations when schema changes: `npm run db:migrate:remote`
3. Deploy Worker API: `npm run deploy:worker`
4. Build frontend: `npm run build`
5. Deploy Pages frontend: `npm run deploy:pages`

## Database Workflow
- Full rebuild schema: `db/schema.sql`
- Forward migrations: `migrations/`
- Create migration: `npm run db:migration:create -- <migration_name>`
- Apply local migrations: `npm run db:migrate:local`
- Apply remote migrations: `npm run db:migrate:remote`
- GitHub Actions runs remote D1 migrations when commit message includes `[db]`.

## Notes
- `db/schema.sql` is for one-off rebuild/reset.
- `migrations/` is the standard production change path.
- Payment tables are ready; Stripe transaction flow is not fully wired yet.
- Server-side media moderation and stronger upload auth hardening are next recommended improvements.
