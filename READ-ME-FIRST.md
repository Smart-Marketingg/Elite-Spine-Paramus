# Backend fix: corrected upload package

This replaces the earlier `backend-fix-upload` folder. The code is the same; the paths and settings were corrected to match the real repo and Cloudflare account.

## What changed from the first package

| Item | First package | This package | Why |
|---|---|---|---|
| Where files go | Repo root | Inside `Elite Spine Paramus (1)/` (except `wrangler.jsonc`) | The site and `functions/` live in that folder, not the repo root |
| `assets.directory` | `.` | `./Elite Spine Paramus (1)` | `.` would have published the repo root and broken every page URL |
| `main` | `worker/index.js` | `./Elite Spine Paramus (1)/worker/index.js` | So the `../functions/...` imports resolve |
| `name` | placeholder | `elite-spine-paramus` | Matches the Worker in the dashboard |
| `database_id` | placeholder | `2333dea3-b324-434d-905f-c5fb4ad9b534` | D1 database `elitespine` now exists |
| Cron | `0 13 * * 1` | `0 13 * * MON` | Cloudflare counts 1 as Sunday |
| `.assetsignore` | repo root | inside `Elite Spine Paramus (1)/`, plus `.DS_Store` | Cloudflare only reads it from the assets folder |

`worker/index.js` and `functions/media/[[path]].js` are unchanged.

## Where each file goes in the repo

```
wrangler.jsonc                                  <- replaces the existing file at the repo root
Elite Spine Paramus (1)/.assetsignore           <- new
Elite Spine Paramus (1)/worker/index.js         <- new
Elite Spine Paramus (1)/functions/media/[[path]].js   <- replaces the existing file
```

`.assetsignore` is a hidden file on a Mac. Press Cmd+Shift+. in Finder to see it, and check it shows in the commit.

## Before you push (the build fails without these)

1. **R2:** in Cloudflare, open R2 Object Storage and add the R2 subscription (free tier, but it asks you to accept billing terms). Then create a bucket named `elitespine-media`.
2. **Database tables:** D1 → `elitespine` → Console → run `schema.sql`. That file is not in the repo or in the package, so it has to come from your local project.

A failed build is safe: the current site stays live.

## After the build succeeds

1. Add the Secrets on `elite-spine-paramus` → Settings → Variables and Secrets: `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optional `RECAPTCHA_SECRET`.
2. Check:
   - `/functions/api/auth/login.js` returns 404
   - `/api/cron/weekly` returns 401 for a POST (405 if opened in a browser)
   - `/api/admin/me` returns 401 when signed out
   - `/admin/` shows the sign-in screen
   - Settings → Trigger events shows "At 01:00 PM on Monday"
3. Delete the `elitespine-weekly` Worker. The site Worker now runs the Monday job itself, and `CRON_SECRET` is not needed.

## What was tested

The package was bundled with Wrangler 4.147 against the repo layout and run locally with placeholder handlers: routing, `[id]` and `[[path]]` parameters, the admin middleware chain, and the hidden files (`functions/`, `worker/`, `uploads/`, `*.md`) all behaved as expected. The real handlers, database and R2 were not exercised.
