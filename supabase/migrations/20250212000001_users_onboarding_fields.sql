-- =============================================================================
-- Users: onboarding fields (city, marketing, terms)
-- =============================================================================

-- phone_number already exists on users from initial schema.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS city_location text,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN users.city_location IS 'User selected city (e.g. for onboarding / local content).';
COMMENT ON COLUMN users.marketing_opt_in IS 'Whether the user accepted marketing communications.';
COMMENT ON COLUMN users.terms_accepted IS 'Whether the user accepted terms of service.';
