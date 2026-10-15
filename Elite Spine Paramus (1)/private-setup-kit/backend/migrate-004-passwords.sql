-- Migration 004: invite links, passwords, forgot/reset password.
-- Run ONCE if your database was created before this update (after 002/003).
-- Fresh installs: schema.sql already includes this.
ALTER TABLE users ADD COLUMN password_hash TEXT;

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
