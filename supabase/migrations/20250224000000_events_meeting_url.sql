-- Online events: store meeting link separately; address can be "온라인" or physical.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS meeting_url text;

COMMENT ON COLUMN events.meeting_url IS 'Video/call link for online events. Shown to RSVPs (public/private) or everyone (exclusive).';
