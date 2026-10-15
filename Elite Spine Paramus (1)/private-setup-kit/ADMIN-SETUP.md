# Admin Portal Setup: Leads + Blog

The admin portal lives at **https://www.elitespineparamus.com/admin/**. It runs on the Cloudflare Pages project you already use. There is no separate server.

- **Login:** Cloudflare Access (Zero Trust). Staff sign in with a one-time code sent to their email. Only emails you approve can get in.
- **Database:** Cloudflare D1 (`DB` binding) stores leads and blog posts.
- **Images:** Cloudflare R2 (`MEDIA` binding) stores uploaded blog images.
- **Code:** `functions/` holds the API and `admin/` holds the portal UI. Both are in `deploy/`.

Forms keep writing to the Google Sheet and also save to the portal, so leads go to both places.

---

## ⚠️ Read first: HIPAA

The appointment form can collect health details (symptoms, conditions). If you are a HIPAA covered entity, every service that stores or transmits that data needs a signed **Business Associate Agreement (BAA)**. As far as I know:

- **Cloudflare** signs BAAs only on **Enterprise** plans, not the free or Pro plans this setup uses.
- **Google Sheets / Apps Script** are covered only under a paid **Google Workspace** account with a signed BAA. A free `@gmail.com` account is not covered.
- **Email alerts** to a Gmail inbox that contain form contents are also not covered.

Check this with Cloudflare, Google, and your compliance advisor before you collect health information in production. Until then, a low-risk option is to change the free-text message field so it asks for scheduling or insurance questions only, not symptoms.

---

## 1. Create the database (D1)

1. Cloudflare dashboard → **Storage & Databases → D1 → Create database**. Name it `elitespine`.
2. Open it → **Console**. Paste the full contents of `backend/schema.sql` and run it.

## 2. Create the image bucket (R2)

1. Dashboard → **R2 → Create bucket**. Name it `elitespine-media`.
2. Leave it **private**. Images are served through `/media/…` by the site itself.

## 3. Bind them to the Pages project

Workers & Pages → your site → **Settings → Bindings** (do this for **Production**):

| Type | Variable name | Value |
|---|---|---|
| D1 database | `DB` | `elitespine` |
| R2 bucket | `MEDIA` | `elitespine-media` |

## 4. Turn on the login (Cloudflare Access)

1. Dashboard → **Zero Trust**. If asked, pick a team name such as `elitespine`. Your team domain becomes `elitespine.cloudflareaccess.com`. The free plan covers up to 50 users.
2. **Settings → Authentication → Login methods**: make sure **One-time PIN** is enabled.
3. **Access → Applications → Add an application → Self-hosted.**
   - Name: `Elite Spine Admin`
   - Session duration: `24 hours`
   - Add **two** destinations on `www.elitespineparamus.com`:
     - Path `admin`
     - Path `api/admin`
   - If you also use the `*.pages.dev` URL, add the same two paths for that hostname.
4. **Policy:** Action **Allow**, Include **Everyone**. Because the login method is the email one-time PIN, only someone who can open that inbox gets in. The portal then checks its own **Users & Access** list and blocks any email that isn't on it. This lets Jullien add and remove people inside the portal without editing Cloudflare.
   - Stricter option: Include **Emails** and list each person. You then have to update both this policy and the portal whenever staff change.
5. Save, then open the application and copy the **Application Audience (AUD) Tag**.

## 5. Add environment variables

Pages project → **Settings → Variables and Secrets** (Production):

| Name | Value |
|---|---|
| `CF_ACCESS_TEAM_DOMAIN` | `elitespine.cloudflareaccess.com` (your team domain) |
| `CF_ACCESS_AUD` | the AUD tag from step 4 |
| `SUPER_ADMINS` | *(optional)* comma-separated super-admin emails. Defaults to `jullien@smartmarketingg.com` if not set. |
| `RECAPTCHA_SECRET` | *(optional)* your reCAPTCHA v3 **secret** key, to block spam in the portal |

The code **fails closed**: if `CF_ACCESS_TEAM_DOMAIN` or `CF_ACCESS_AUD` is missing, nobody can open the admin, including you.

## 6. Deploy

Upload the `deploy/` folder to GitHub as usual. Cloudflare Pages finds the `functions/` folder automatically. **Redeploy after adding bindings or variables**, because they only apply to new deployments.

## 7. Test

1. Submit the appointment form on the live site.
2. Go to `/admin/`, enter your email, and type the code you receive.
3. The lead appears under **Leads** marked **New**.
4. Under **Blog Posts → New post**, write a test post, click **Publish now**, and check that it shows on `/blog`.

---

## Using the portal

**Leads**
- Tabs filter by status: New, Contacted, Booked, Closed. Search checks name, phone, email, service, and message.
- Click a lead to open it. From there you can **Call**, **Text**, or **Email**, and change the status in one click.
- **Export CSV** downloads whatever the current filters show.
- Deleting a lead removes it from the portal only. It stays in the Google Sheet.
- The list refreshes itself every 60 seconds.

**Blog**
- **Draft:** visible only in the portal.
- **Publish with no date:** goes live immediately.
- **Publish with a future date:** scheduled. It appears on the blog automatically at that time, with no manual step.
- The featured image, category, tags, SEO title, and meta description are in the right sidebar. The Google preview updates as you type.
- **Preview** shows the post in the blog's layout before you publish.
- Ctrl/Cmd + S saves.
- The 4 original articles stay built into the site (`blog-posts.js`). New posts from the portal appear above them.

**Audit trail:** status changes, deletions, exports, and publishes are logged in the `audit` table in D1.

**Signing out:** click **Sign out** in the sidebar, or wait for the 24-hour session to expire.

## Adding or removing staff

Sign in as **jullien@smartmarketingg.com** (super admin), then open **Users & Access** in the sidebar:

- **Add a person:** enter their email, pick their access, and click **Add person**. They sign in at `/admin` with a code sent to their email.
- **Leads:** No access / View only / Manage. Manage also allows changing status, deleting, and exporting CSV.
- **Blog:** No access / Write drafts / Publish. Publish also allows scheduling, editing live posts, and deleting.
- **Can manage users:** lets that person add and remove others. Give this sparingly.
- **Pause** blocks sign-in without deleting the person. **Remove** deletes their access.

The clinic account `elitespineparamus@gmail.com` starts with full Leads + Blog access but cannot manage users. Jullien can change that.

Super admins (set by `SUPER_ADMINS`) always have full access and can't be changed or removed from inside the portal. This prevents anyone from locking Jullien out.

**Already ran the old schema?** Run `backend/schema.sql` again. Every statement uses `IF NOT EXISTS` / `INSERT OR IGNORE`, so it only adds the new `users` table.


---

## Pipelines, auto-replies and lead source tracking

### 1. Update the database (once)
- **Haven't run `schema.sql` yet:** just run the new `backend/schema.sql`. It includes everything.
- **Already ran it:** open D1 → `elitespine` → Console, paste `backend/migrate-002-pipelines-autoreplies.sql`, and run it **once**. Existing leads are kept. (Running it a second time fails on the last step with "duplicate column", which is harmless.)

### 2. Turn on email sending for auto-replies (Resend, free up to 3,000 emails/month)
1. Sign up at resend.com → **Domains → Add domain** → `elitespineparamus.com`.
2. Resend shows 3–4 DNS records. In Cloudflare → DNS, add them exactly (Resend has a one-click "Sign in to Cloudflare" option too). Wait for **Verified**.
3. Resend → **API Keys → Create** (Sending access). Copy it.
4. Cloudflare → your Pages site → Settings → **Variables and Secrets** (Production):
   - `RESEND_API_KEY` = the key (type: Secret)
   - `MAIL_FROM` = `Elite Spine & Sports Care <hello@elitespineparamus.com>` (optional; this is the default)
5. Redeploy. The Auto-replies screen will say **Email sending is on**. Use **Send test to me** to check.

Until the key is added, rules still save and every lead shows "Not sent" in its auto-reply history, so nothing breaks.

**Safeguards built in:** each address gets at most 3 automatic emails per day; a stage email (e.g. "Booked") is sent only once per lead; patient messages are never inserted into emails. Replies go to `elitespineparamus@gmail.com` unless you set another reply-to address on the rule.

### 3. Who can edit them / see sources
- **See lead source** (checkbox under each person's Leads access): when off, that person sees no channel, UTM, campaign, click ID or referrer anywhere: not in the list, board, lead panel, filters, search or CSV export. It's hidden on the server, not just the screen. Only a super admin can change it. New people get it on unless the super admin unticks it. (The Google Sheet still has these columns; control Sheet sharing separately.)
- If you already ran migrate-002 before this setting existed, also run `backend/migrate-003-lead-source-permission.sql` once.
Users & Access now has a **Setup** switch: "Can edit pipelines & auto-replies". Super admins and the clinic account have it. Everyone with Leads → Manage can still move leads between stages.

### 4. Lead source tracking
Every form now records where the visitor came from: channel (Google Ads, Google Business Profile, Organic Search, Social, Meta Ads, Email, Referral, Direct), UTM source/medium/campaign/term/content, Google/Microsoft/Meta click IDs, referrer, landing page, and how they **first** found the site (kept for 90 days). It's stored on the lead, shown in the lead drawer, filterable on the Leads screen (Source chips + Campaign menu), included in CSV export, and added as new columns in the Google Sheet automatically.

**Tag your links so they're classified correctly:**
- **Google Ads:** keep **auto-tagging** on (Ads → Admin → Account settings). That adds `gclid` and marks leads as Google Ads. Optionally add a final URL suffix: `utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}`.
- **Google Business Profile website link:** `https://www.elitespineparamus.com/?utm_source=google&utm_medium=gbp&utm_campaign=listing` (and the appointment link with `utm_campaign=appointment`).
- **Facebook/Instagram ads:** `utm_source=facebook&utm_medium=paid_social&utm_campaign=<name>`.
- **Instagram bio / organic posts:** `utm_source=instagram&utm_medium=social&utm_campaign=bio-link`.
- **Emails/newsletters:** `utm_medium=email`.

Leads submitted before this update show as **Direct** with no tracking details.


---

## Sign-in with invites and passwords (replaces the Cloudflare one-time code)

The portal now has its own accounts. People are **invited**, set their own **password**, and can use **Forgot password** to reset it.

### Set it up
1. **Database:** if your database already exists, run `backend/migrate-004-passwords.sql` once in the D1 Console. Fresh installs: `schema.sql` already includes it.
2. **Email (Resend):** required for invite and reset emails. See "Turn on email sending" above (`RESEND_API_KEY`). Without it, admins can still copy invite links, but nobody can get reset emails.
3. **Remove the Cloudflare Access app** (Zero Trust → Access → Applications → Elite Spine Admin → Delete). Otherwise people have to sign in twice. You can also delete the `CF_ACCESS_AUD` / `CF_ACCESS_TEAM_DOMAIN` variables.
4. Redeploy.

### First sign-in (Jullien)
Go to `/admin`, click **Forgot password?**, and enter **jullien@smartmarketingg.com**. Open the email, choose a password, and you're in. Super admins don't need an invite.

*No email set up yet?* Keep the Cloudflare Access app for now, sign in with the code, open **Set password** in the sidebar, then remove Access.

### Inviting people
Users & Access → fill in their email and access → **Send invite**. They get an email with a link (valid 7 days, works once), and you get the same link to copy in case the email doesn't arrive. The person shows as **Invited** until they set a password. Use **Resend invite** for a new link; the old one stops working.

### Security details
- Passwords are hashed (PBKDF2-SHA256, 100,000 rounds, unique salt). Links and session cookies are stored only as SHA-256 hashes.
- Passwords need at least 10 characters. Very common ones are blocked.
- 5 wrong passwords lock that email for 15 minutes. Forgot-password requests are rate limited and never reveal whether an email has an account.
- Sessions use a secure HttpOnly cookie. "Keep me signed in" lasts 30 days; otherwise 12 hours.
- Resetting a password signs that person out everywhere. Pausing or removing someone ends their sessions immediately.
- Each signed-in person can **Change password** from the sidebar.


---

## AI Writer (Claude writes blog posts from your Google Business Profile posts)

Every Monday, the portal reads new posts from the Elite Spine Google Business Profile. Claude writes a full blog article for each one, up to your weekly limit. Depending on your setting, the article is either **saved as a draft for approval** (the default) or **published automatically**. You get an email either way. Staff can also paste any Google post or topic into **AI Writer → Write one now**.

### 1. Database
Run `backend/migrate-005-ai-writer.sql` once in the D1 Console. Fresh installs: `schema.sql` has it.

### 2. Claude
1. Go to console.anthropic.com → API Keys → Create key. Add a few dollars of credit; each post costs a few cents.
2. Cloudflare → Pages site → Settings → Variables and Secrets → add `ANTHROPIC_API_KEY` (Secret).
   Optional: `ANTHROPIC_MODEL` to choose a specific Claude model (default `claude-sonnet-4-5`).

### 3. Google Business Profile (one-time)
Google doesn't let websites scrape Business Profile posts, so this uses Google's official API.
1. console.cloud.google.com → create a project, e.g. "Elite Spine Portal".
2. **Request Business Profile API access:** search "Business Profile API access request" and submit the form with the project number. Google approves in about 1–5 business days.
3. APIs & Services → Library → enable **My Business Account Management API**, **My Business Business Information API** and **Google My Business API**.
4. APIs & Services → OAuth consent screen → External → add the clinic's Google account as a test user (or publish the app).
5. Credentials → Create OAuth client ID → **Web application** → Authorized redirect URI: `https://www.elitespineparamus.com/api/gbp/callback`.
6. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (Secret) to the Pages site, then redeploy.
7. In the portal: **AI Writer → Connect Google** and sign in with the Google account that manages the profile. If it manages several locations, pick Elite Spine Paramus.

The Google access token is stored encrypted. **Disconnect** removes it.

Until API access is approved, use **Write one now → Google post** and paste the text of each new Google post.

### 4. Weekly schedule
Pages can't run timers, so a tiny Worker in `cron-worker/` triggers the job every Monday at 13:00 UTC.
1. Make up a long random secret and add it to the Pages site as `CRON_SECRET` (Secret). Redeploy.
2. From a computer with Node: `cd cron-worker`, then `npx wrangler deploy`, then `npx wrangler secret put CRON_SECRET` (paste the same secret).
   No command line? Cloudflare → Workers & Pages → Create → Worker → paste `cron-worker/worker.js`. Add a Variable `SITE_URL` and a Secret `CRON_SECRET`. Under Triggers → Cron, add `0 13 * * 1`.

### How approval works
- **Wait for my approval** (default): new posts are drafts marked **Needs review**. Approve & publish, open them to edit, or Reject (deleted, and that Google post won't be rewritten).
- **Publish automatically:** posts go live immediately. Writers without Publish access always get drafts.
- Claude is instructed not to invent patient stories, prices or medical claims, and to keep offer and event details exactly as written. Read a few drafts before switching to auto-publish.
- If the Google post has a photo, it's copied into your media storage and used as the post's featured image.
