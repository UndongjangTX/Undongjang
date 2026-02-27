import { createClient } from "@/lib/supabase/client";

export type UserProfile = {
  id: string;
  full_name?: string | null;
  phone_number?: string | null;
  city_location?: string | null;
  avatar_url?: string | null;
  marketing_opt_in: boolean;
  terms_accepted: boolean;
  is_yongbyung: boolean;
  interested_categories: string[];
};

/**
 * Fetches the currently authenticated user's profile from public.users.
 * Returns null if not signed in or profile not found.
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  let { data: row, error } = await supabase
    .from("users")
    .select("id, full_name, phone_number, city_location, avatar_url, marketing_opt_in, terms_accepted, is_yongbyung, interested_categories")
    .eq("id", session.user.id)
    .maybeSingle();

  // No row (e.g. user created before trigger or trigger failed): ensure row exists then refetch
  if ((error?.code === "PGRST116" || !row) && session.user.id) {
    const meta = session.user.user_metadata ?? {};
    const fullName =
      (meta.full_name as string) ||
      (meta.name as string) ||
      (session.user.email?.split("@")[0] ?? "User");
    await supabase.from("users").upsert(
      {
        id: session.user.id,
        full_name: fullName,
      },
      { onConflict: "id" }
    );
    const next = await supabase
      .from("users")
      .select("id, full_name, phone_number, city_location, avatar_url, marketing_opt_in, terms_accepted, is_yongbyung, interested_categories")
      .eq("id", session.user.id)
      .maybeSingle();
    row = next.data;
    error = next.error;
  }

  if (error || !row) return null;

  // Normalize phone_number: DB may return string or number; ensure we store string | null
  const rawPhone = row.phone_number;
  const phone_number =
    rawPhone == null
      ? null
      : typeof rawPhone === "string"
        ? (rawPhone.trim() || null)
        : String(rawPhone).trim() || null;

  return {
    id: row.id,
    full_name: row.full_name ?? null,
    phone_number,
    city_location: row.city_location ?? null,
    avatar_url: (row as { avatar_url?: string | null }).avatar_url ?? null,
    marketing_opt_in: row.marketing_opt_in ?? false,
    terms_accepted: row.terms_accepted ?? false,
    is_yongbyung: row.is_yongbyung ?? false,
    interested_categories: Array.isArray(row.interested_categories)
      ? (row.interested_categories as string[])
      : [],
  };
}

/**
 * Returns true if the profile has a non-empty phone number.
 * Safe for null/undefined profile and for phone_number stored as number in DB.
 */
export function hasPhoneNumber(profile: UserProfile | null): boolean {
  if (!profile) return false;
  const p = profile.phone_number;
  if (p == null) return false;
  return String(p).trim() !== "";
}

const AVATARS_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/gif"];

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type))
    return "Please use a JPG, PNG, or GIF image.";
  if (file.size > MAX_AVATAR_BYTES) return "Image must be 2MB or smaller.";
  return null;
}

/**
 * Uploads a profile photo to storage and updates users.avatar_url.
 * Path: avatars/{userId}/{timestamp}.{ext}. Returns new avatar_url or null on error.
 */
export async function uploadProfilePhoto(userId: string, file: File): Promise<string | null> {
  const err = validateAvatarFile(file);
  if (err) return null;
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (uploadErr) return null;
  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  const { error: updateErr } = await supabase
    .from("users")
    .update({ avatar_url: data.publicUrl })
    .eq("id", userId);
  if (updateErr) return null;
  return data.publicUrl;
}

