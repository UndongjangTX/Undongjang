-- =============================================================================
-- Supabase Schema: Categories, Users, Groups, Events + RLS
-- =============================================================================

-- Event type enum
CREATE TYPE event_type AS ENUM ('Lightning', 'Regular', 'Special');

-- -----------------------------------------------------------------------------
-- Categories
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE
);

CREATE INDEX idx_categories_slug ON categories(slug);

-- -----------------------------------------------------------------------------
-- Users (extends Supabase auth; id = auth.uid())
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone_number text,
  is_yongbyung boolean NOT NULL DEFAULT false,
  interested_categories uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Optional: validate that interested_categories only contains valid category IDs
-- (can be done with a trigger or check + unnest)

-- -----------------------------------------------------------------------------
-- Groups
-- -----------------------------------------------------------------------------
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  group_category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  is_boosted boolean NOT NULL DEFAULT false,
  location_city text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_groups_category ON groups(group_category_id);
CREATE INDEX idx_groups_boosted ON groups(is_boosted) WHERE is_boosted = true;

-- -----------------------------------------------------------------------------
-- Events
-- -----------------------------------------------------------------------------
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  event_theme_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  event_type event_type NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  is_boosted boolean NOT NULL DEFAULT false,
  host_group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT events_end_after_start CHECK (end_time > start_time)
);

CREATE INDEX idx_events_theme ON events(event_theme_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_start ON events(start_time);
CREATE INDEX idx_events_host_group ON events(host_group_id);
CREATE INDEX idx_events_boosted ON events(is_boosted) WHERE is_boosted = true;

-- -----------------------------------------------------------------------------
-- Group members (users join groups) — only authenticated users can join
-- -----------------------------------------------------------------------------
CREATE TABLE group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);

-- -----------------------------------------------------------------------------
-- Event attendees (users join events) — only authenticated users can join
-- -----------------------------------------------------------------------------
CREATE TABLE event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX idx_event_attendees_user ON event_attendees(user_id);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Categories: public read
-- -----------------------------------------------------------------------------
CREATE POLICY "Categories are viewable by everyone"
  ON categories FOR SELECT
  TO public
  USING (true);

-- Only service role / admins should insert/update/delete categories (no policy = no access for anon/authenticated)

-- -----------------------------------------------------------------------------
-- Users: users can read/update own row (needed for profile)
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Optional: allow public to read limited user info for display (e.g. host name). Omit if you want profiles private.

-- -----------------------------------------------------------------------------
-- Groups: public read; authenticated can join (insert/delete in group_members)
-- -----------------------------------------------------------------------------
CREATE POLICY "Groups are viewable by everyone"
  ON groups FOR SELECT
  TO public
  USING (true);

-- Allow authenticated to create groups (optional; add if users can create groups)
-- CREATE POLICY "Authenticated can create groups"
--   ON groups FOR INSERT TO authenticated WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Events: public read
-- -----------------------------------------------------------------------------
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  TO public
  USING (true);

-- -----------------------------------------------------------------------------
-- Group members: public read (see who is in a group); only authenticated can join/leave
-- -----------------------------------------------------------------------------
CREATE POLICY "Group members are viewable by everyone"
  ON group_members FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can join groups"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave a group (delete own membership)"
  ON group_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Event attendees: public read; only authenticated can join/leave
-- -----------------------------------------------------------------------------
CREATE POLICY "Event attendees are viewable by everyone"
  ON event_attendees FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can join events"
  ON event_attendees FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave an event (delete own registration)"
  ON event_attendees FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================================
-- Trigger: create user profile on signup (optional but recommended)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Seed a few categories (optional)
-- =============================================================================
-- INSERT INTO categories (name, slug) VALUES
--   ('Sports', 'sports'),
--   ('Art', 'art'),
--   ('Tech', 'tech'),
--   ('Social', 'social');
