# Backend fix plan: run the CRM on the existing Cloudflare Worker

## Diagnosis
- The site is deployed as a **Worker with static assets** (Workers Builds from GitHub), not a Pages project.
- Workers don't run a `functions/` folder. Cloudflare served it as plain files, so:
  1. every `/api/*` route returns 404 (CRM, forms → D1, login, cron), and
  2. the backend source is publicly downloadable (`/functions/api/auth/login.js`, etc.).
- "Variables cannot be added to a Worker that only has static assets": the Worker has no script (`main`), so it can't have bindings or secrets.

## Chosen fix: keep the Worker and add a server entry point (no domain move)
Moving to Pages would mean a new project plus moving both domains. Adding an entry point keeps the current project, domains and GitHub connection.

### Code changes (done in this project)
1. **`worker/index.js`**: a single Worker entry that
   - imports every existing handler in `functions/` (unchanged code) and routes requests the way Pages Functions did: same URL paths, `[id]` / `[[path]]` params, `onRequestGet/Post/...` methods, and the `_middleware.js` chain for `/api/admin/*` and `/admin/*`;
   - passes everything else to static assets (`env.ASSETS.fetch`);
   - adds a **`scheduled()`** handler, so the Monday AI Writer job runs inside the site Worker. The separate `elitespine-weekly` Worker and `CRON_SECRET` are no longer required.
2. **`wrangler.jsonc`** (repo root): `main`, assets settings (`run_worker_first` for `/api/*`, `/admin*`, `/media/*`), D1 `DB`, R2 `MEDIA`, cron trigger, plain vars `SITE_URL` and `SUPER_ADMINS`.
3. **`.assetsignore`** (repo root): excludes `functions/`, `worker/`, config files, docs, SQL and scripts from public assets. This closes the source-code leak.
4. **`functions/media/[[path]].js`**: also serve `ai/` images (AI Writer hero images were blocked by the `blog/`-only check).

### Dashboard / repo steps (user)
1. **Repo:** upload `worker/`, `wrangler.jsonc`, `.assetsignore` and the updated `functions/media/[[path]].js`. If the repo already has a `wrangler.toml` / `wrangler.json(c)`, **delete it** (only one config file is allowed). Copy its `name` value into the new `wrangler.jsonc` first.
2. **`name`** in `wrangler.jsonc` must exactly match the Worker's name in the dashboard, or Workers Builds fails.
3. **Create the resources** (if not done): D1 `elitespine` and R2 `elitespine-media`. Paste the D1 **Database ID** into `wrangler.jsonc`.
4. **Database tables:** D1 → Console → run `schema.sql` (fresh) or migrations 002→005 (existing).
5. **Build settings:** Worker → Settings → Build → Deploy command `npx wrangler deploy`, no build command, root directory `/`.
6. **Push / commit** → wait for the build to succeed.
7. **Secrets** (now allowed): Worker → Settings → Variables and Secrets → Add, type **Secret** each: `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optional `RECAPTCHA_SECRET`. Secrets survive future deploys; plain vars come from `wrangler.jsonc`.
8. **Google OAuth redirect URI** stays `https://www.elitespineparamus.com/api/gbp/callback`.
9. **elitespine-weekly Worker:** no longer needed. Delete it (or leave it disabled). Skip `CRON_SECRET`.

### Verification checklist
- `https://www.elitespineparamus.com/functions/api/auth/login.js` → **404** (leak closed).
- `/api/cron/weekly` → **401** JSON (route alive, correctly locked), not 404.
- `/api/admin/me` → **401** JSON when signed out.
- `/admin/` loads the sign-in screen; Forgot password emails Jullien a link (needs `RESEND_API_KEY`).
- Submit the website form → the lead shows in CRM → Leads, and still lands in the Google Sheet.
- Worker → Settings → Trigger events shows cron `0 13 * * 1`.
- Worker → Logs show no errors after a request.

### If the build fails
- "name mismatch" → fix `name` in `wrangler.jsonc`.
- "D1 database not found" → wrong `database_id`.
- "R2 bucket not found" → create `elitespine-media` or fix `bucket_name`.
- "entry-point file … inside assets directory" → `.assetsignore` missing from the repo root.
- "asset too large" again → a file over 25 MiB is in the repo. Add it to `.assetsignore` or host it elsewhere.
