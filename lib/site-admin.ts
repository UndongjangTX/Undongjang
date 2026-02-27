import { createClient } from "@/lib/supabase/client";

export async function isSiteAdmin(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("site_admins")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export type SiteAdminUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  created_at: string;
};

export async function listUsersForAdmin(): Promise<SiteAdminUserRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, phone_number, created_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as SiteAdminUserRow[];
}

export type SiteAdminGroupRow = {
  id: string;
  name: string;
  memberCount: number;
  is_boosted: boolean;
  boosted_until: string | null;
  created_at: string;
};

export async function listGroupsForAdmin(): Promise<SiteAdminGroupRow[]> {
  const supabase = createClient();
  await supabase.rpc("expire_boosted_entities", {});
  const { data: groups, error } = await supabase
    .from("groups")
    .select("id, name, created_at, is_boosted, boosted_until")
    .order("created_at", { ascending: false });
  if (error || !groups?.length) return [];
  const ids = groups.map((g) => g.id);
  const { data: counts } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", ids);
  const byId: Record<string, number> = {};
  ids.forEach((id) => (byId[id] = 0));
  counts?.forEach((r) => { byId[r.group_id] = (byId[r.group_id] ?? 0) + 1; });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: byId[g.id] ?? 0,
    is_boosted: g.is_boosted ?? false,
    boosted_until: g.boosted_until ?? null,
    created_at: g.created_at,
  }));
}

export type SiteAdminEventRow = {
  id: string;
  title: string;
  start_time: string;
  is_boosted: boolean;
  boosted_until: string | null;
  host_group_id: string | null;
  created_at: string;
};

export async function listEventsForAdmin(): Promise<SiteAdminEventRow[]> {
  const supabase = createClient();
  await supabase.rpc("expire_boosted_entities", {});
  const { data, error } = await supabase
    .from("events")
    .select("id, title, start_time, is_boosted, boosted_until, host_group_id, created_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as SiteAdminEventRow[];
}

export type BoostRequestRow = {
  id: string;
  type: "group" | "event";
  entity_id: string;
  requested_by: string;
  requester_name: string | null;
  boost_end_date: string | null;
  status: string;
  created_at: string;
  entity_title: string | null;
};

export async function listBoostRequests(status?: "pending" | "approved" | "rejected"): Promise<BoostRequestRow[]> {
  const supabase = createClient();
  let q = supabase
    .from("boost_requests")
    .select("id, type, entity_id, requested_by, boost_end_date, status, created_at")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data: rows, error } = await q;
  if (error || !rows?.length) return [];
  const userIds = [...new Set(rows.map((r) => r.requested_by))];
  const { data: users } = await supabase.from("users").select("id, full_name").in("id", userIds);
  const nameBy = new Map((users ?? []).map((u) => [u.id, (u as { full_name: string | null }).full_name ?? null]));
  const groupIds = rows.filter((r) => r.type === "group").map((r) => r.entity_id);
  const eventIds = rows.filter((r) => r.type === "event").map((r) => r.entity_id);
  const [groupsRes, eventsRes] = await Promise.all([
    groupIds.length ? supabase.from("groups").select("id, name").in("id", groupIds) : { data: [] },
    eventIds.length ? supabase.from("events").select("id, title").in("id", eventIds) : { data: [] },
  ]);
  const groupNames = new Map((groupsRes.data ?? []).map((g) => [g.id, (g as { name: string }).name]));
  const eventTitles = new Map((eventsRes.data ?? []).map((e) => [e.id, (e as { title: string }).title]));
  return rows.map((r) => ({
    ...r,
    requester_name: nameBy.get(r.requested_by) ?? null,
    entity_title: r.type === "group" ? groupNames.get(r.entity_id) ?? null : eventTitles.get(r.entity_id) ?? null,
  })) as BoostRequestRow[];
}

export async function approveBoostRequest(
  requestId: string,
  adminUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: req, error: fetchErr } = await supabase
    .from("boost_requests")
    .select("type, entity_id, status, boost_end_date")
    .eq("id", requestId)
    .single();
  if (fetchErr || !req || req.status !== "pending")
    return { ok: false, error: "Request not found or already processed." };
  const { error: updateReq } = await supabase
    .from("boost_requests")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: adminUserId })
    .eq("id", requestId);
  if (updateReq) return { ok: false, error: updateReq.message };
  const payload = { is_boosted: true, boosted_until: (req as { boost_end_date?: string | null }).boost_end_date ?? null };
  if (req.type === "group") {
    await supabase.from("groups").update(payload).eq("id", req.entity_id);
  } else {
    await supabase.from("events").update(payload).eq("id", req.entity_id);
  }
  return { ok: true };
}

export async function rejectBoostRequest(
  requestId: string,
  adminUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: req } = await supabase.from("boost_requests").select("status").eq("id", requestId).single();
  if (!req || req.status !== "pending") return { ok: false, error: "Request not found or already processed." };
  const { error } = await supabase
    .from("boost_requests")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: adminUserId })
    .eq("id", requestId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setGroupBoosted(groupId: string, boosted: boolean, boostedUntil?: string | null): Promise<boolean> {
  const supabase = createClient();
  const payload = { is_boosted: boosted, boosted_until: boostedUntil ?? null };
  const { error } = await supabase.from("groups").update(payload).eq("id", groupId);
  return !error;
}

export async function setEventBoosted(eventId: string, boosted: boolean, boostedUntil?: string | null): Promise<boolean> {
  const supabase = createClient();
  const payload = { is_boosted: boosted, boosted_until: boostedUntil ?? null };
  const { error } = await supabase.from("events").update(payload).eq("id", eventId);
  return !error;
}

export async function setGroupBoostedUntil(groupId: string, boostedUntil: string | null): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("groups").update({ boosted_until: boostedUntil }).eq("id", groupId);
  return !error;
}

export async function setEventBoostedUntil(eventId: string, boostedUntil: string | null): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("events").update({ boosted_until: boostedUntil }).eq("id", eventId);
  return !error;
}

export async function deleteGroupAdmin(groupId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  return !error;
}

export async function deleteEventAdmin(eventId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  return !error;
}

// -----------------------------------------------------------------------------
// Categories (admin)
// -----------------------------------------------------------------------------
export type SiteAdminCategoryRow = {
  id: string;
  name: string;
  name_ko: string | null;
  slug: string;
  emoji: string;
};

export async function listCategoriesForAdmin(): Promise<SiteAdminCategoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, name_ko, slug, emoji")
    .order("name");
  if (error || !data) return [];
  return data as SiteAdminCategoryRow[];
}

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9-]/g, "");
}

export async function createCategoryAdmin(params: {
  name: string;
  name_ko: string | null;
  emoji: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const name = params.name?.trim();
  const emoji = (params.emoji?.trim() || "📅").slice(0, 10);
  if (!name) return { ok: false, error: "Name is required." };
  let slug = slugFromName(name) || "category";
  const { data: existing } = await supabase.from("categories").select("slug").ilike("slug", `${slug}%`);
  const slugs = new Set((existing ?? []).map((r) => (r as { slug: string }).slug));
  let candidate = slug;
  let n = 1;
  while (slugs.has(candidate)) {
    candidate = `${slug}-${n}`;
    n++;
  }
  slug = candidate;
  const { data: inserted, error } = await supabase
    .from("categories")
    .insert({ name, name_ko: params.name_ko?.trim() || null, slug, emoji })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (inserted as { id: string }).id };
}

export async function updateCategoryAdmin(
  id: string,
  params: { name?: string; name_ko?: string | null; emoji?: string; slug?: string }
): Promise<boolean> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (params.name !== undefined) payload.name = params.name.trim();
  if (params.name_ko !== undefined) payload.name_ko = params.name_ko?.trim() || null;
  if (params.emoji !== undefined) payload.emoji = (params.emoji.trim() || "📅").slice(0, 10);
  if (params.slug !== undefined) payload.slug = params.slug.trim().toLowerCase();
  if (Object.keys(payload).length === 0) return true;
  const { error } = await supabase.from("categories").update(payload).eq("id", id);
  return !error;
}

export async function deleteCategoryAdmin(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
