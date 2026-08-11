-- backend/migrations/add_referral_system.sql
-- Run: psql -U postgres -d ai_interview -f add_referral_system.sql

-- Add referral columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code    VARCHAR(12)  UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_count   INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits          INTEGER      NOT NULL DEFAULT 0;

-- Generate referral codes for existing users
UPDATE users
SET referral_code = UPPER(SUBSTRING(MD5(id::text || email), 1, 8))
WHERE referral_code IS NULL;

-- Make referral_code NOT NULL after populating
ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by   ON users(referred_by);

-- Referral events log
CREATE TABLE IF NOT EXISTS referral_events (
  id              SERIAL PRIMARY KEY,
  referrer_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reward_given    BOOLEAN NOT NULL DEFAULT FALSE,
  reward_type     VARCHAR(50),   -- 'bonus_session', 'pro_extension', etc.
  reward_value    INTEGER,       -- number of sessions or days
  UNIQUE(referred_id)            -- each user can only be referred once
);

CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON referral_events(referrer_id);