-- =============================================================================
-- One-time bootstrap: first logged-in user can make themselves site admin
-- =============================================================================

CREATE OR REPLACE FUNCTION public.bootstrap_site_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF (SELECT COUNT(*) FROM site_admins) > 0 THEN
    RETURN false; -- already has at least one admin
  END IF;
  INSERT INTO site_admins (user_id) VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.bootstrap_site_admin IS 'One-time: if there are no site admins, add the current user. Call via supabase.rpc(''bootstrap_site_admin'').';

GRANT EXECUTE ON FUNCTION public.bootstrap_site_admin() TO authenticated;
