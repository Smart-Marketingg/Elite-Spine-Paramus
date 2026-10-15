# Elite Spine backend: complete file list (44 files)

Commit these to the **repo root** of `Smart-Marketingg/Elite-Spine-Paramus`, keeping these exact paths. Nothing else is needed for the backend to build. The website pages, `images/`, `admin/` (portal UI) and `app.js` stay as they are in the repo.

## Config (3)
- wrangler.jsonc
- .assetsignore
- worker/index.js

## Shared libraries (6)
- functions/_lib/access.js
- functions/_lib/ai.js
- functions/_lib/auth.js
- functions/_lib/automation.js
- functions/_lib/ga.js
- functions/_lib/util.js

## Middleware (2)
- functions/admin/_middleware.js
- functions/api/admin/_middleware.js

## Public API (10)
- functions/api/lead.js
- functions/api/posts.js
- functions/api/auth/accept.js
- functions/api/auth/forgot.js
- functions/api/auth/login.js
- functions/api/auth/logout.js
- functions/api/auth/token.js
- functions/api/cron/weekly.js
- functions/api/gbp/callback.js
- functions/media/[[path]].js

## Admin API (22)
- functions/api/admin/ai.js
- functions/api/admin/ai/review.js
- functions/api/admin/ai/run.js
- functions/api/admin/ai/write.js
- functions/api/admin/analytics.js
- functions/api/admin/autoreplies.js
- functions/api/admin/autoreplies/[id].js
- functions/api/admin/autoreplies/test.js
- functions/api/admin/gbp/connect.js
- functions/api/admin/gbp/location.js
- functions/api/admin/invite.js
- functions/api/admin/leads.js
- functions/api/admin/leads/[id].js
- functions/api/admin/leads/export.js
- functions/api/admin/me.js
- functions/api/admin/password.js
- functions/api/admin/pipelines.js
- functions/api/admin/posts.js
- functions/api/admin/posts/[id].js
- functions/api/admin/upload.js
- functions/api/admin/users.js
- functions/api/admin/users/[email].js

(This file, FILES.md, is the 44th. Don't commit it; `.assetsignore` would hide it anyway.)

## Import check
Every `import` in `worker/index.js` and in each file above resolves to a file in this list. Every imported name is exported by its target. `functions/_lib/ga.js` and `functions/media/[[path]].js` import nothing.

## Before you commit: two values only you have
`wrangler.jsonc` still has two placeholders that can't be filled in from here:
1. `"name"`: the Worker's exact name in Cloudflare (Workers & Pages → the site). If the repo's current cut-down config has a `name`, copy it from there.
2. `"database_id"`: Cloudflare → Storage & Databases → D1 → **elitespine** → Database ID.

The build fails if either is wrong. Everything else is set: D1 `elitespine` (DB), R2 `elitespine-media` (MEDIA), cron `0 13 * * MON`, `run_worker_first` for `/api/*`, `/admin`, `/admin/*` and `/media/*`, and `GA4_PROPERTY_ID` = `529168761`.

## Make sure the repo has only ONE Wrangler config
Delete any `wrangler.toml` or `wrangler.json` in the repo root, so `wrangler.jsonc` is the only one.

## Secrets (Cloudflare → Worker → Settings → Variables and Secrets → type Secret)
- `GA_SERVICE_ACCOUNT`: the full service-account JSON. The analytics endpoint reads it from here.
- `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- optional `RECAPTCHA_SECRET`, `CRON_SECRET` (the cron runs inside this Worker, so `CRON_SECRET` is only needed for `/api/cron/weekly` manual calls)

## After it deploys
- `/functions/api/auth/login.js` → 404 (source is no longer public)
- `/api/cron/weekly` → 401 JSON (backend alive)
- `/api/admin/me` → 401 JSON when signed out
- `/admin/` → sign-in screen
