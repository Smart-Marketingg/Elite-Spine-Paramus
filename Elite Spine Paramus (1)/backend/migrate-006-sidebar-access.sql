-- Migration 006: super admins can switch individual sidebar sections on/off per person.
-- Run ONCE on a database created before this update (D1 → elitespine → Console).
-- Fresh installs from the current schema.sql already have this column.
ALTER TABLE users ADD COLUMN off TEXT NOT NULL DEFAULT '[]';
