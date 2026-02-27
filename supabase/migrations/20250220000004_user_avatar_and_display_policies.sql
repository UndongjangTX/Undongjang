-- =============================================================================
-- User profile photo (avatar) + RLS for group/event member display
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
COMMENT ON COLUMN users.avatar_url IS 'Profile photo URL (e.g. Supabase Storage avatars bucket).';

-- Storage: avatars bucket for profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public read for avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Allow reading id, full_name, avatar_url for users who are group members or group organizers (for group detail "Members")
CREATE POLICY "Public can read group members and organizers display"
  ON users FOR SELECT
  TO public
  USING (
    EXISTS (SELECT 1 FROM group_members gm WHERE gm.user_id = users.id)
    OR EXISTS (SELECT 1 FROM groups g WHERE g.organizer_id = users.id)
  );

-- Extend event attendee display: allow reading users who are event hosts (for event detail "Attendees")
-- Drop the existing event-attendees-only policy and recreate one that includes hosts
DROP POLICY IF EXISTS "Public can read event attendees display names" ON users;
CREATE POLICY "Public can read event attendees and hosts display"
  ON users FOR SELECT
  TO public
  USING (
    EXISTS (SELECT 1 FROM event_attendees ea WHERE ea.user_id = users.id)
    OR EXISTS (SELECT 1 FROM event_hosts eh WHERE eh.user_id = users.id)
  );
