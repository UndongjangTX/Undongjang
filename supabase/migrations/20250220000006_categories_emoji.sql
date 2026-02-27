-- Add emoji column to categories. Single source of truth for theme/category display.
-- Set per category in DB; default 📅 so existing rows show a calendar icon until updated.
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '📅';

COMMENT ON COLUMN categories.emoji IS 'Emoji for this category (e.g. 🧳 for Career & Business). Used in nav filters and calendar.';
