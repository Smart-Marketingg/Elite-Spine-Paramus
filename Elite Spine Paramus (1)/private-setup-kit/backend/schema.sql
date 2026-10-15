-- Elite Spine admin — D1 schema (fresh install)
-- Run once:  wrangler d1 execute elitespine --remote --file=backend/schema.sql
-- (or paste into Cloudflare dashboard → D1 → elitespine → Console)
-- Already ran an older version? Run backend/migrate-002-pipelines-autoreplies.sql instead.

CREATE TABLE IF NOT EXISTS leads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT,
  form        TEXT,
  source      TEXT,
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  service     TEXT,
  message     TEXT,
  data        TEXT,
  status      TEXT NOT NULL DEFAULT 'new',   -- stage key from the lead's pipeline
  status_by   TEXT,
  channel      TEXT,   -- Google Ads, Organic Search, Google Business Profile, Social, Direct…
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  utm_term     TEXT,
  utm_content  TEXT,
  click_id     TEXT,   -- gclid:/gbraid:/wbraid:/msclkid:/fbclid:<value>
  referrer     TEXT,
  landing_page TEXT,
  first_touch  TEXT,   -- how they first found the site, e.g. "google / cpc / spring"
  first_seen   TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_form    ON leads(form);
CREATE INDEX IF NOT EXISTS idx_leads_channel ON leads(channel);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(utm_campaign);

CREATE TABLE IF NOT EXISTS posts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  excerpt          TEXT,
  body_html        TEXT,
  category         TEXT,
  tags             TEXT,
  hero             TEXT,
  seo_title        TEXT,
  seo_description  TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  publish_at       TEXT,
  author           TEXT,
  origin           TEXT NOT NULL DEFAULT 'manual',   -- manual | ai
  origin_ref       TEXT,                             -- Google post id for AI posts
  review           TEXT,                             -- pending | approved | auto (AI posts)
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_pub ON posts(status, publish_at DESC);

CREATE TABLE IF NOT EXISTS audit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  actor      TEXT,
  action     TEXT,
  target     TEXT
);

-- Portal users. Super admins (SUPER_ADMINS env var, default jullien@smartmarketingg.com)
-- are not stored here; they always have full access and manage everyone below.
CREATE TABLE IF NOT EXISTS users (
  email       TEXT PRIMARY KEY,
  name        TEXT,
  leads       TEXT NOT NULL DEFAULT 'none' CHECK (leads IN ('none','view','manage')),
  blog        TEXT NOT NULL DEFAULT 'none' CHECK (blog IN ('none','write','publish')),
  users       INTEGER NOT NULL DEFAULT 0,
  setup       INTEGER NOT NULL DEFAULT 0,   -- can edit pipelines + auto-replies
  source      INTEGER NOT NULL DEFAULT 1,   -- can see where leads came from (super admins control this)
  password_hash TEXT,                       -- PBKDF2; NULL until they accept their invite
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  created_by  TEXT,
  last_seen   TEXT
);

-- Clinic owner: full leads + blog + setup; Jullien can change this in the portal.
INSERT OR IGNORE INTO users (email, name, leads, blog, users, setup, created_by)
VALUES ('elitespineparamus@gmail.com', 'Elite Spine Paramus', 'manage', 'publish', 0, 1, 'setup');

-- Key/value settings (pipelines live here as JSON).
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_by  TEXT,
  updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS autoreplies (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  trigger     TEXT NOT NULL DEFAULT 'submit' CHECK (trigger IN ('submit','stage')),
  forms       TEXT NOT NULL DEFAULT '[]',   -- submit trigger: JSON list, [] = every form
  pipeline    TEXT,                          -- stage trigger
  stage       TEXT,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  reply_to    TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT,
  updated_by  TEXT
);

CREATE TABLE IF NOT EXISTS email_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  lead_id     INTEGER,
  rule_id     INTEGER,
  to_email    TEXT,
  subject     TEXT,
  status      TEXT,   -- sent | failed | skipped
  error       TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_lead ON email_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_to   ON email_log(to_email, at);

-- Starter auto-reply (off until someone reviews and turns it on).
INSERT INTO autoreplies (name, enabled, trigger, forms, subject, body, updated_by)
SELECT 'Thanks for reaching out', 0, 'submit', '[]',
  'We got your request, {{first_name}}',
  'Hi {{first_name}},

Thanks for contacting Elite Spine & Sports Care in Paramus. We received your request about {{service}} and a member of our team will reach out shortly, usually within one business day.

Want to lock in a time now? Book online: {{booking_link}}
Or call us at {{clinic_phone}}.

Talk soon,
Elite Spine & Sports Care',
  'setup'
WHERE NOT EXISTS (SELECT 1 FROM autoreplies);

-- Portal sign-in: invite / reset links, sessions, and rate limiting.
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash  TEXT PRIMARY KEY,               -- SHA-256 of the link token (the token itself is never stored)
  email       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('invite','reset')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_by  TEXT
);
CREATE INDEX IF NOT EXISTS idx_tokens_email ON auth_tokens(email, kind);
CREATE TABLE IF NOT EXISTS sessions (
  id_hash     TEXT PRIMARY KEY,               -- SHA-256 of the session cookie
  email       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  last_seen   TEXT,
  expires_at  TEXT NOT NULL,
  ip          TEXT,
  ua          TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);
CREATE TABLE IF NOT EXISTS login_attempts (
  key  TEXT NOT NULL,
  at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts ON login_attempts(key, at);

-- AI Writer: track which Google Business Profile posts were already turned into blog posts.
CREATE TABLE IF NOT EXISTS gbp_posts (
  name     TEXT PRIMARY KEY,        -- Google's post id
  summary  TEXT,
  media    TEXT,
  created  TEXT,
  url      TEXT,
  status   TEXT,                    -- processing | done | failed | rejected
  error    TEXT,
  post_id  INTEGER,
  seen_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
