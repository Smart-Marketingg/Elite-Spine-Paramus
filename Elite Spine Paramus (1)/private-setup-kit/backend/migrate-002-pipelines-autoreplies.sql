-- Migration 002: custom pipelines + auto-replies + lead source (UTM) tracking
-- Run ONCE on a database created with the earlier schema.sql
-- (Cloudflare dashboard → D1 → elitespine → Console → paste → Execute).
-- Fresh installs don't need this; schema.sql already includes everything.

-- 1) Leads: remove the fixed New/Contacted/Booked/Closed check so custom stages work,
--    and add lead source columns. Existing leads are kept (their source shows as Direct/unknown).
CREATE TABLE leads_v2 (
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
  status      TEXT NOT NULL DEFAULT 'new',
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
INSERT INTO leads_v2 (id, created_at, updated_at, form, source, name, email, phone, service, message, data, status, status_by)
  SELECT id, created_at, updated_at, form, source, name, email, phone, service, message, data, status, status_by FROM leads;
DROP TABLE leads;
ALTER TABLE leads_v2 RENAME TO leads;
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_form    ON leads(form);
CREATE INDEX IF NOT EXISTS idx_leads_channel ON leads(channel);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(utm_campaign);

-- 2) New tables
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_by TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS autoreplies (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  trigger     TEXT NOT NULL DEFAULT 'submit' CHECK (trigger IN ('submit','stage')),
  forms       TEXT NOT NULL DEFAULT '[]',
  pipeline    TEXT,
  stage       TEXT,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  reply_to    TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT,
  updated_by  TEXT
);
CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  lead_id INTEGER, rule_id INTEGER, to_email TEXT, subject TEXT, status TEXT, error TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_lead ON email_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_to   ON email_log(to_email, at);

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

-- 3) Users: new "Setup" permission (edit pipelines + auto-replies). Owner gets it.
ALTER TABLE users ADD COLUMN setup INTEGER NOT NULL DEFAULT 0;
UPDATE users SET setup = 1 WHERE email = 'elitespineparamus@gmail.com';

-- 4) Users: "See lead source" permission (on by default; super admins can turn it off per person).
ALTER TABLE users ADD COLUMN source INTEGER NOT NULL DEFAULT 1;
