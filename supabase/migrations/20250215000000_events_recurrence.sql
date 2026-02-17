-- =============================================================================
-- Events: recurrence rule (Option B) — interval + series id for future instances
-- =============================================================================

-- Recurrence interval: when is_recurring = true, how often it repeats
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurrence_interval text
  CHECK (recurrence_interval IS NULL OR recurrence_interval IN ('daily', 'weekly', 'monthly'));

COMMENT ON COLUMN events.recurrence_interval IS 'When is_recurring: daily, weekly, or monthly. NULL for one-off or legacy.';

-- Series anchor: NULL = this event is the series root (shows once, represents the recurring series).
-- Non-NULL = future instance pointing at the root (for when we generate occurrences).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurrence_series_id uuid REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_recurrence_series ON events(recurrence_series_id)
  WHERE recurrence_series_id IS NOT NULL;

COMMENT ON COLUMN events.recurrence_series_id IS 'When set, this event is an instance of the series identified by this id. NULL = series root.';
