-- Recurring: which occurrence a user RSVPs to
ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS occurrence_start_time timestamptz;

COMMENT ON COLUMN event_attendees.occurrence_start_time IS 'For recurring events: which occurrence the user RSVPd to. NULL = one-off or legacy.';

-- Monthly recurrence: which week of month (1-5, 5=last) and weekday (0=Sun..6=Sat)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurrence_weekday smallint,
  ADD COLUMN IF NOT EXISTS recurrence_week_of_month smallint;

COMMENT ON COLUMN events.recurrence_weekday IS '0=Sunday..6=Saturday. Used for weekly (from start_time) and monthly.';
COMMENT ON COLUMN events.recurrence_week_of_month IS '1=1st week..4=4th, 5=last week of month. Only for monthly.';
