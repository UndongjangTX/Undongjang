# Site admin dashboard

## Access and security

- **URL:** The dashboard is at `/manage` by default.
- **Recommendation:** To avoid an obvious path, you can:
  1. **Rename the route:** Rename the `app/manage` folder to something non-obvious (e.g. `app/z9k2` or a random string). The URL will then be `yoursite.com/z9k2`. Update the "Back to site" link and any internal links if you rename.
  2. **Restrict by IP:** Use Next.js middleware or your host to allow only specific IPs to access `/manage` (or your custom path).
  3. **Keep access in the DB:** Only users listed in the `site_admins` table can see the dashboard; others get "You don't have access."

## Adding site admins

**First admin (no admins yet):** Log in, then open **`/bootstrap-admin`** and click "Make me site admin". This runs a one-time DB function that adds you to `site_admins` only when the table is empty.

**Later admins:** Insert the user id into `site_admins` (e.g. via Supabase SQL editor):

```sql
INSERT INTO site_admins (user_id) VALUES ('your-auth-user-uuid');
```

## Tabs

- **Users:** List of all users (name, email, joined).
- **Groups:** List groups; view, boost/unboost, delete.
- **Events:** List events; view, boost/unboost, delete; create special events (always boosted).
- **Boost requests:** Pending requests from group/event admins; approve or reject.
