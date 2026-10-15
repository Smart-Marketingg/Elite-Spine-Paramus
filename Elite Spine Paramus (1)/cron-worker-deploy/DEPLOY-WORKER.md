# Deploy the weekly AI Writer timer (Cloudflare Worker)

Cloudflare Pages can't run anything on a schedule, so this tiny Worker does one thing: every **Monday at 13:00 UTC** (9 AM Eastern in summer, 8 AM in winter), it asks your website to check the Google Business Profile for new posts and have Claude write the blog drafts.

It holds no patient data and no API keys, only a shared password (`CRON_SECRET`) that proves the request came from you.

Files in this folder:
- `worker.js`: the Worker code (paste this into Cloudflare)
- `wrangler.toml`: only needed for the command-line method (Option B)

---

## Step 1: Make the shared password

Create a long random string of at least 40 characters, letters and numbers only. Use any of these:
- a password manager's generator (1Password, Bitwarden, etc.)
- Mac/Linux Terminal: `openssl rand -hex 32`
- Windows PowerShell: `-join ((48..57)+(97..102) | Get-Random -Count 64 | % {[char]$_})`

Keep it handy for the next 2 steps. Don't email it or paste it anywhere else.

## Step 2: Give the password to your website (Pages)

1. Cloudflare dashboard → **Workers & Pages** → your **website** project (the Pages site).
2. **Settings → Variables and Secrets → Production → Add**.
3. Type: **Secret**. Name: `CRON_SECRET`. Value: the password from Step 1. Save.
4. **Deployments** → latest deployment → **⋯ → Retry deployment** (settings only apply to new deployments).

---

## Step 3, Option A: Create the Worker in the dashboard (no coding tools needed)

1. **Workers & Pages → Create → Create Worker.**
2. Name it `elitespine-weekly` → **Deploy** (it deploys a placeholder first).
3. Click **Edit code**. Delete everything in the editor, paste in all of `worker.js`, then click **Deploy**.
4. Go back to the Worker → **Settings → Variables and Secrets → Add**:
   - Type **Text**, name `SITE_URL`, value `https://www.elitespineparamus.com`
   - Type **Secret**, name `CRON_SECRET`, value: the **same** password from Step 1
   - Click **Deploy** if it asks.
5. **Settings → Trigger events** (may be labeled **Triggers → Cron Triggers**) → **Add** → **Cron trigger** → choose *Custom* and enter:
   ```
   0 13 * * 1
   ```
   Save. Cloudflare shows the next run time.
6. Optional cleanup: **Settings → Domains & Routes** → turn off the `workers.dev` URL. The Worker doesn't need a public address; visiting it only returns "Nothing to see here" anyway.

## Step 3, Option B: Deploy from the command line (if you use Node.js)

```bash
cd cron-worker-deploy
npx wrangler login
npx wrangler deploy
npx wrangler secret put CRON_SECRET   # paste the same password from Step 1
```
The schedule and `SITE_URL` come from `wrangler.toml` automatically.

---

## Step 4: Test it

The quickest check doesn't need the Worker: in the CRM, open **AI Writer → Check Google now**. That runs the same job right away.

To test the Worker itself:
- In the Worker's **Edit code** screen, use the **Schedule** / **Trigger scheduled event** button in the preview panel if you see one. Or run `npx wrangler dev --test-scheduled` with Option B.
- Then open the Worker → **Logs** (Observability). You should see `weekly job 200 {...}`.
  - `401 unauthorized`: the two `CRON_SECRET` values don't match, or you didn't redeploy the Pages site after adding it.
  - `200 … "skipped":"AI Writer is paused"`: turn on "Check Google every week" in AI Writer settings.
  - `200 … "error":"Google Business Profile isn't connected."`: connect Google in AI Writer first.

In the CRM, **AI Writer → Weekly check** shows "Last checked …" after each run.

---

## Good to know

- **Change the day or time:** edit the cron trigger. Examples: `0 14 * * 3` = Wednesdays 14:00 UTC; `0 13 * * 1,4` = Mondays and Thursdays.
- **Pause it:** untick "Check Google every week" in AI Writer settings. No need to touch the Worker.
- **Rotate the password:** make a new one, update `CRON_SECRET` in **both** the Pages site and the Worker, then redeploy the Pages site.
- **Cost:** cron Workers are included in Cloudflare's free plan. One run a week is nowhere near the limits.
- **Keep this folder off GitHub.** It isn't dangerous (no secrets inside), but it isn't part of the website.
