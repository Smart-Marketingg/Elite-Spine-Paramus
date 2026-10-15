-- Migration 003: per-user "See lead source" permission.
-- Only needed if you ALREADY ran migrate-002 before this column was added to it.
-- (If you run migrate-002 fresh, it already includes this.)
ALTER TABLE users ADD COLUMN source INTEGER NOT NULL DEFAULT 1;
