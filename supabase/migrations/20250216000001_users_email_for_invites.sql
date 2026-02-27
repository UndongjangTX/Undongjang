-- Add email to public.users for invite-by-email (lookup). Synced from auth.users.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN users.email IS 'Synced from auth.users for lookups (e.g. group invite by email).';

-- Update trigger to set email on new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    full_name,
    phone_number,
    terms_accepted,
    marketing_opt_in,
    email
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone_number',
    COALESCE((NEW.raw_user_meta_data->>'terms_accepted')::boolean, false),
    COALESCE((NEW.raw_user_meta_data->>'marketing_opt_in')::boolean, false),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Backfill existing users' email from auth.users (requires SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.sync_user_emails_from_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.users u
  SET email = a.email
  FROM auth.users a
  WHERE a.id = u.id AND (u.email IS DISTINCT FROM a.email);
END;
$$;

SELECT public.sync_user_emails_from_auth();
