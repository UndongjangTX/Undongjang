import { createClient } from "@/lib/supabase/client";

export type GroupListItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  locationCity: string | null;
  memberCount: number;
  categoryName: string;
  /** Display name (name_ko ?? name) for UI. */
  categoryDisplayName: string;
  is_boosted: boolean;
  isPrivate: boolean;
};

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=400&fit=crop";

export async function getGroups(): Promise<GroupListItem[]> {
  const supabase = createClient();
  const { data: groupsData, error: groupsError } = await supabase
    .from("groups")
    .select("id, name, description, cover_image_url, location_city, group_category_id, is_boosted, boosted_until, privacy, organizer_id, categories(name, name_ko)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (groupsError || !groupsData?.length) return [];

  const ids = groupsData.map((g) => g.id);
  const { data: membersData } = await supabase
    .from("group_members")
    .select("group_id, user_id")
    .in("group_id", ids);

  const memberSetByGroup: Record<string, Set<string>> = {};
  ids.forEach((id) => (memberSetByGroup[id] = new Set()));
  membersData?.forEach((r) => {
    memberSetByGroup[r.group_id]?.add(r.user_id);
  });
  const countByGroup: Record<string, number> = {};
  groupsData.forEach((g) => {
    const set = memberSetByGroup[g.id] ?? new Set();
    const organizerId = (g as { organizer_id?: string | null }).organizer_id ?? null;
    if (organizerId && !set.has(organizerId)) countByGroup[g.id] = set.size + 1;
    else countByGroup[g.id] = set.size;
  });

  const today = new Date().toISOString().slice(0, 10);
  return groupsData.map((g) => {
    const until = (g as { boosted_until?: string | null }).boosted_until ?? null;
    const effectiveBoosted = (g.is_boosted ?? false) && (!until || until >= today);
    return {
      id: g.id,
      name: g.name,
      description: g.description ?? null,
      imageUrl: g.cover_image_url || DEFAULT_COVER,
      locationCity: g.location_city ?? null,
      memberCount: countByGroup[g.id] ?? 0,
      categoryName: (() => { const c = g.categories as { name: string; name_ko?: string | null }[] | { name: string; name_ko?: string | null } | null; return (Array.isArray(c) ? c[0]?.name : c?.name) ?? "Uncategorized"; })(),
      categoryDisplayName: (() => { const c = g.categories as { name: string; name_ko?: string | null }[] | { name: string; name_ko?: string | null } | null; const cat = Array.isArray(c) ? c[0] : c; return (cat?.name_ko?.trim() || cat?.name) ?? "Uncategorized"; })(),
      is_boosted: effectiveBoosted,
      isPrivate: (g as { privacy?: boolean }).privacy === true,
    };
  });
}

/** Groups sorted by member count (most popular first). */
export async function getPopularGroups(limit = 8): Promise<GroupListItem[]> {
  const all = await getGroups();
  return [...all]
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, limit);
}

export type MemberProfile = { user_id: string; full_name: string | null; avatar_url: string | null };

export type GroupDetailData = {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string;
  locationCity: string | null;
  memberCount: number;
  /** Organizer first, then members (photo + name for display). */
  memberProfiles: MemberProfile[];
  categoryName: string;
  /** Display name (name_ko ?? name) for UI. */
  categoryDisplayName: string;
  groupCategoryId: string | null;
  organizerName: string | null;
  organizerId: string | null;
  isPrivate: boolean;
  upcomingEvents: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    eventType: "Lightning" | "Regular" | "Special";
    imageUrl: string;
    location: string | null;
    recurrenceLabel: string | null;
  }>;
  photoUrls: string[];
  /** When set, group is hidden from public; owner can restore within 7 days. */
  deleted_at: string | null;
};

function formatEventTime(start: string, end: string | null): string {
  const d = new Date(start);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  let s = d.toLocaleDateString("en-US", options);
  if (end) {
    const e = new Date(end);
    s += ` to ${e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  return s;
}

export async function getGroupById(id: string): Promise<GroupDetailData | null> {
  const supabase = createClient();
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select(`
      id,
      name,
      description,
      cover_image_url,
      location_city,
      organizer_id,
      group_category_id,
      privacy,
      deleted_at,
      categories(name, name_ko)
    `)
    .eq("id", id)
    .single();

  if (groupError || !group) return null;

  const [membersRowsRes, eventsRes, photosRes, organizerRes] = await Promise.all([
    supabase.from("group_members").select("user_id").eq("group_id", id),
    supabase
      .from("events")
      .select("id, title, start_time, end_time, event_type, banner_image_url, address, location_name, recurrence_interval")
      .eq("host_group_id", id)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(6),
    supabase.from("group_photos").select("image_url").eq("group_id", id).order("display_order"),
    group.organizer_id
      ? supabase.from("users").select("id, full_name, avatar_url").eq("id", group.organizer_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const memberUserIds = (membersRowsRes.data ?? []).map((r) => r.user_id);
  const organizerInMembers = group.organizer_id && memberUserIds.includes(group.organizer_id);
  const memberCount = memberUserIds.length + (group.organizer_id && !organizerInMembers ? 1 : 0);
  const events = eventsRes.data ?? [];
  const photos = photosRes.data ?? [];
  const organizerName = (organizerRes.data as { full_name?: string | null } | null)?.full_name ?? null;

  const orderedMemberIds: string[] = group.organizer_id
    ? [group.organizer_id, ...memberUserIds.filter((uid) => uid !== group.organizer_id)]
    : [...memberUserIds];

  let memberProfiles: MemberProfile[] = [];
  if (orderedMemberIds.length > 0) {
    const { data: usersData } = await supabase
      .from("users")
      .select("id, full_name, avatar_url")
      .in("id", orderedMemberIds);
    const byId = new Map(
      (usersData ?? []).map((u) => [
        u.id,
        {
          user_id: u.id,
          full_name: (u as { full_name: string | null }).full_name ?? null,
          avatar_url: (u as { avatar_url: string | null }).avatar_url ?? null,
        },
      ])
    );
    memberProfiles = orderedMemberIds.map((uid) => byId.get(uid) ?? { user_id: uid, full_name: "Someone", avatar_url: null });
  }

  const defaultEventImage =
    "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=560&h=238&fit=crop";

  function recurrenceLabel(interval: string | null | undefined): string | null {
    if (!interval) return null;
    switch (interval) {
      case "daily":
        return "Repeats daily";
      case "weekly":
        return "Repeats weekly";
      case "monthly":
        return "Repeats monthly";
      default:
        return null;
    }
  }

  return {
    id: group.id,
    name: group.name,
    description: group.description ?? null,
    coverImageUrl: group.cover_image_url || DEFAULT_COVER,
    locationCity: group.location_city ?? null,
    memberCount,
    memberProfiles,
    categoryName: (() => { const c = group.categories as { name: string; name_ko?: string | null }[] | { name: string; name_ko?: string | null } | null; return (Array.isArray(c) ? c[0]?.name : c?.name) ?? "Uncategorized"; })(),
    categoryDisplayName: (() => { const c = group.categories as { name: string; name_ko?: string | null }[] | { name: string; name_ko?: string | null } | null; const cat = Array.isArray(c) ? c[0] : c; return (cat?.name_ko?.trim() || cat?.name) ?? "Uncategorized"; })(),
    groupCategoryId: group.group_category_id ?? null,
    organizerName,
    organizerId: group.organizer_id ?? null,
    isPrivate: group.privacy === true,
    deleted_at: (group as { deleted_at?: string | null }).deleted_at ?? null,
    upcomingEvents: events.map((e) => ({
      id: e.id,
      title: e.title,
      startTime: formatEventTime(e.start_time, e.end_time),
      endTime: e.end_time ? new Date(e.end_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "",
      eventType: e.event_type as "Lightning" | "Regular" | "Special",
      imageUrl: e.banner_image_url || defaultEventImage,
      location: e.location_name || e.address || null,
      recurrenceLabel: recurrenceLabel((e as { recurrence_interval?: string }).recurrence_interval),
    })),
    photoUrls: photos.map((p) => p.image_url).filter(Boolean),
  };
}

export type GroupOrganizedByUser = {
  id: string;
  name: string;
  groupCategoryId: string | null;
};

export async function getGroupsOrganizedByUser(
  userId: string
): Promise<GroupOrganizedByUser[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, group_category_id")
    .eq("organizer_id", userId)
    .order("name");
  if (error || !data) return [];
  return data.map((g) => ({
    id: g.id,
    name: g.name,
    groupCategoryId: g.group_category_id ?? null,
  }));
}

/** True if the user is the group owner (organizer). */
export async function isGroupOwner(
  groupId: string,
  userId: string
): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("groups")
    .select("organizer_id")
    .eq("id", groupId)
    .single();
  return data?.organizer_id === userId;
}

/** True if the user is an assigned admin (not owner). */
export async function isGroupAdmin(
  groupId: string,
  userId: string
): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("group_admins")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** True if the user can manage the group (owner or admin). */
export async function canManageGroup(
  groupId: string,
  userId: string
): Promise<boolean> {
  const [owner, admin] = await Promise.all([
    isGroupOwner(groupId, userId),
    isGroupAdmin(groupId, userId),
  ]);
  return owner || admin;
}

/** Groups the user belongs to (owner or member), including deleted for owner (for restore). */
export async function getMyGroups(userId: string): Promise<
  { id: string; name: string; cover_image_url: string | null; organizer_id: string | null; deleted_at: string | null; isOwner: boolean }[]
> {
  const supabase = createClient();
  const [owned, memberRows] = await Promise.all([
    supabase.from("groups").select("id, name, cover_image_url, organizer_id, deleted_at").eq("organizer_id", userId),
    supabase.from("group_members").select("group_id").eq("user_id", userId),
  ]);
  const memberIds = (memberRows.data ?? []).map((r) => r.group_id);
  const ownedList = (owned.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    cover_image_url: g.cover_image_url ?? null,
    organizer_id: g.organizer_id ?? null,
    deleted_at: (g as { deleted_at?: string | null }).deleted_at ?? null,
    isOwner: true,
  }));
  if (memberIds.length === 0) return ownedList;
  const { data: memberGroups } = await supabase
    .from("groups")
    .select("id, name, cover_image_url, organizer_id, deleted_at")
    .in("id", memberIds);
  const byId = new Map(ownedList.map((g) => [g.id, g]));
  (memberGroups ?? []).forEach((g) => {
    if (!byId.has(g.id)) {
      byId.set(g.id, {
        id: g.id,
        name: g.name,
        cover_image_url: g.cover_image_url ?? null,
        organizer_id: g.organizer_id ?? null,
        deleted_at: (g as { deleted_at?: string | null }).deleted_at ?? null,
        isOwner: false,
      });
    }
  });
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Groups the user can manage (as organizer or admin), for boost request form. */
export async function getGroupsUserCanManage(userId: string): Promise<{ id: string; name: string }[]> {
  const supabase = createClient();
  const [organized, adminRows] = await Promise.all([
    supabase.from("groups").select("id, name").eq("organizer_id", userId).is("deleted_at", null).order("name"),
    supabase.from("group_admins").select("group_id").eq("user_id", userId),
  ]);
  const adminGroupIds = (adminRows.data ?? []).map((r) => r.group_id);
  const organizedList = (organized.data ?? []) as { id: string; name: string }[];
  if (adminGroupIds.length === 0) return organizedList;
  const { data: adminGroups } = await supabase
    .from("groups")
    .select("id, name")
    .in("id", adminGroupIds)
    .is("deleted_at", null)
    .order("name");
  const byId = new Map(organizedList.map((g) => [g.id, g]));
  (adminGroups ?? []).forEach((g) => byId.set(g.id, { id: g.id, name: (g as { name: string }).name }));
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}
