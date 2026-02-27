-- Add optional Korean display name for categories (managed in admin).
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS name_ko text;

COMMENT ON COLUMN categories.name_ko IS 'Korean display name for this category. Used in admin and UI when set.';
