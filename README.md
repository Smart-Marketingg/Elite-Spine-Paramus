# Elite Spine & Sports Care — website + CRM

One Cloudflare Worker (`elite-spine-paramus`) serves the static site and the CRM:

| Piece | Where |
| --- | --- |
| Website (HTML/CSS/JS, Claude Design export) | `Elite Spine Paramus (1)/` |
| Worker entry + router | `Elite Spine Paramus (1)/worker/index.js` |
| API handlers (Pages-Functions style) | `Elite Spine Paramus (1)/functions/` |
| Team portal | `Elite Spine Paramus (1)/admin/` → https://www.elitespineparamus.com/admin/ |
| Database schema (D1, idempotent) | `Elite Spine Paramus (1)/schema.sql` (+ `schema.oneline.sql` for the dashboard console) |
| Config | `wrangler.jsonc` (root) |
| Tests | `tests/` (`npm test`), `npm run check` parses every script |

Live: D1 `elitespine`, R2 `elitespine-media` (public at media.elitespineparamus.com). Preview builds use `elitespine-preview` D1 and `elitespine-media-preview`.

## What a website form does

1. `app.js` adds a hidden honeypot field (`website`) to every `.cform__form` and, when `TURNSTILE_SITE_KEY` is set, a Cloudflare Turnstile widget (site key fetched from `/api/config`).
2. On submit it POSTs to `/api/lead` (and, as a backup, to the old Google Apps Script sheet while `SHEET_ENDPOINT` is still set in `app.js`).
3. `/api/lead` checks: same origin → honeypot → per-IP rate limit (8 per 10 min, stored in `login_attempts` under `lead:<ip hash>`) → Turnstile (`TURNSTILE_SECRET`; skipped while unset) → phone or email present → CRM not shut down.
4. The lead is inserted into `leads`, the clinic is emailed through Resend (`NOTIFY_EMAILS`, per-form `NOTIFY_ROUTES`), auto-replies run. Notification sends are logged in `email_log` with `rule_id = 0`; failures are retried by the 15-minute cron (max 4 tries in 24 h).

## Settings (wrangler.jsonc `vars`)

`SITE_URL`, `SUPER_ADMINS`, `BUSINESS_NAME`, `BUSINESS_PHONE`, `BUSINESS_ADDRESS`, `BOOKING_URL`, `NOTIFY_EMAILS`, `NOTIFY_ROUTES`, `MAIL_FROM`, `MAIL_REPLY_TO`, `TIMEZONE`, `BRAND_COLOR`, `IDLE_MINUTES`, `TURNSTILE_SITE_KEY`, `GA4_PROPERTY_ID`, `MEDIA_URL`.

## Secrets (never in the repo)

Set with `npx wrangler secret put NAME` (Node 22 + wrangler 4) or in the dashboard → Worker → Settings → Variables and Secrets:

| Secret | Used for |
| --- | --- |
| `SETTINGS_KEY` | encrypts API keys saved from the portal (already set) |
| `RESEND_API_KEY` | lead notifications, auto-replies, invites, password resets. Sending-only key for a domain verified in Resend (`elitespineparamus.com`) |
| `TURNSTILE_SECRET` | Turnstile server check. Pair with the public `TURNSTILE_SITE_KEY` var |
| `GA_SERVICE_ACCOUNT` | Analytics tab (already set) |
| `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID/SECRET` | optional: AI Writer / Google Business Profile (can also be added from the portal) |

`/api/health` returns booleans for each integration; super admins also see a yellow "Setup" strip in the portal while something is missing.

## Turnstile setup

1. Cloudflare dashboard → Turnstile → Add widget. Hostnames: `elitespineparamus.com`, `www.elitespineparamus.com` (add the `*.workers.dev` preview host too). Mode: Managed.
2. Put the **site key** in `wrangler.jsonc` → `vars.TURNSTILE_SITE_KEY` (and `previews.vars`). Commit.
3. `npx wrangler secret put TURNSTILE_SECRET` with the **secret key**.
Until both exist, forms still work (honeypot + rate limit only).

## Resend setup

1. Resend → Domains → add `elitespineparamus.com`, create the DKIM/SPF records it lists in Cloudflare DNS, wait for "Verified".
2. Resend → API keys → create a **sending-only** key → `npx wrangler secret put RESEND_API_KEY`.
3. `MAIL_FROM` must be on that domain (`hello@elitespineparamus.com`). Replies go to `MAIL_REPLY_TO`.
4. Submit a test form; the email_log table (portal → lead → Emails) shows `sent`.
5. Once notifications are confirmed, set `SHEET_ENDPOINT = ''` in `app.js` to stop the Google Sheet copy.

## Portal security

- Session cookie `es_session`: HttpOnly, Secure, SameSite=Strict. 12 h (or 30 days with "remember me"), idle sign-out after `IDLE_MINUTES` (30) — 7 days idle for remember-me sessions.
- Every write needs a same-origin `Origin` **and** `X-Requested-With: crm` (CSRF). Sign-in endpoints need a same-origin Origin/Referer.
- Login rate limits: 5 per email / 25 per IP per 15 min. Password resets and lead posts are rate-limited the same way.
- `/admin` and `/api` responses carry CSP (`script-src 'self'`), `no-store`, `noindex`, `X-Frame-Options: DENY`, HSTS, nosniff.

## Local development

```bash
npm test                 # unit tests (Node 20+)
npm run check            # parse every script
npm run schema:local     # create the local D1 tables
npm run dev              # http://localhost:8787  (needs wrangler 4 → Node 22)
```

Create `.dev.vars` (git-ignored) with `SETTINGS_KEY=anything` and, optionally, `RESEND_API_KEY=` / `TURNSTILE_SECRET=`.

## Deploying

- `main` → Workers Builds deploys production automatically.
- Other branches (`Dev`) → Workers Builds **preview** versions using the `previews` block (separate D1/R2). Check the Worker's Builds settings: the non-production command must be a `versions upload`, never `wrangler deploy --env …`.
- Schema changes: edit `schema.sql` (keep it idempotent), run `npm run schema:preview`, test, then `npm run schema:live`.

## Site updates from Claude Design

Claude Design holds the website only. The CRM (`functions/`, `worker/`, `admin/`, `wrangler.jsonc`, `schema.sql`) lives
only in this repo, so an export cannot overwrite it, but the export bundle also contains stale `crm/`, `backend/`,
`export/` and `uploads/` folders that must never be copied in. Two site files carry CRM wiring and exist in both places:
`app.js` (honeypot, Turnstile, the post to `/api/lead`) and `styles.css` (the `.cform__turnstile` rule). Keep the
Claude Design copies identical to the repo copies; whenever a CRM change touches either file, paste the new version
into Claude Design as well.

Never export straight into this folder. Export to a scratch folder and run:

```bash
npm run import:design -- "/path/to/Elite Spine Paramus"            # dry run: lists what would change
npm run import:design -- "/path/to/Elite Spine Paramus" --apply    # copy
```

The script copies only site files (top-level HTML/CSS/JS, `images/`, `_headers`, `_redirects`, robots, sitemap, llms.txt),
ignores everything CRM-related, and refuses to copy `app.js` or `styles.css` if the incoming copy lacks the CRM markers.
A refusal means Claude Design is behind the repo: update it there first, or keep the repo copy and import the rest.
