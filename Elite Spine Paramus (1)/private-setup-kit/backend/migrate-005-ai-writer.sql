-- Migration 005: Claude AI Writer for the blog.
-- Run ONCE if your database was created before this update. Fresh installs: schema.sql has it.
ALTER TABLE posts ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE posts ADD COLUMN origin_ref TEXT;
ALTER TABLE posts ADD COLUMN review TEXT;

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
