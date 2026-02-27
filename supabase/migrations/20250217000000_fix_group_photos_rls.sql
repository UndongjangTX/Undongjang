-- Fix group_photos INSERT RLS: use a SECURITY DEFINER function so the new row's group_id
-- is correctly evaluated (avoids "new row violates row-level security policy" on insert).

CREATE OR REPLACE FUNCTION public.can_manage_group_photos(check_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM groups g
    LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
    WHERE g.id = check_group_id
      AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
  );
$$;

-- Drop and recreate INSERT policy to use the function
DROP POLICY IF EXISTS "Group owner and admins can insert group photos" ON group_photos;

CREATE POLICY "Group owner and admins can insert group photos"
  ON group_photos FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_group_photos(group_id));
