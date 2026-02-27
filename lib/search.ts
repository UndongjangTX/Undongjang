import { createClient } from "@/lib/supabase/client";
import { formatEventTime, formatEventLocation } from "@/lib/events";

const DEFAULT_EVENT_IMAGE =
  "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=560&h=238&fit=crop";
const DEFAULT_GROUP_COVER =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=400&fit=crop";

export type SearchEventItem = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  eventType: "Lightning" | "Regular" | "Special";
  imageUrl: string;
  location?: string;
};

export type SearchGroupItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  locationCity: string | null;
  memberCount: number;
  isPrivate?: boolean;
};

export type SearchSuggestion = {
  label: string;
  type: "event" | "group";
  id: string;
};

function toPattern(q: string): string {
  return `%${q.replace(/[%_]/g, "").trim()}%`;
}

export async function searchEvents(query: string): Promise<SearchEventItem[]> {
  const q = query.trim();
  if (!q) return [];

  const supabase = createClient();
  const now = new Date().toISOString();
  const pattern = toPattern(q);

  let result = await supabase
    .from("events")
    .select("id, title, start_time, end_time, event_type, banner_image_url, address, location_name")
    .gte("start_time", now)
    .in("privacy", ["public", "private"])
    .or(`title.ilike.${pattern},address.ilike.${pattern},location_name.ilike.${pattern}`)
    .order("start_time", { ascending: true })
    .limit(24);
  if (result.error) {
    result = await supabase
      .from("events")
      .select("id, title, start_time, end_time, event_type, banner_image_url, address, location_name")
      .gte("start_time", now)
      .or(`title.ilike.${pattern},address.ilike.${pattern},location_name.ilike.${pattern}`)
      .order("start_time", { ascending: true })
      .limit(24);
  }
  const events = result.data;
  if (result.error || !events?.length) return [];

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    startTime: formatEventTime(e.start_time, e.end_time),
    endTime: e.end_time
      ? new Date(e.end_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : "",
    eventType: (e.event_type as "Lightning" | "Regular" | "Special") || "Regular",
    imageUrl: e.banner_image_url || DEFAULT_EVENT_IMAGE,
    location: formatEventLocation(e) ?? undefined,
  }));
}

export async function searchGroups(query: string): Promise<SearchGroupItem[]> {
  const q = query.trim();
  if (!q) return [];

  const supabase = createClient();
  const pattern = toPattern(q);

  const { data: groupsData, error } = await supabase
    .from("groups")
    .select("id, name, description, cover_image_url, location_city, privacy, organizer_id")
    .is("deleted_at", null)
    .or(`name.ilike.${pattern},description.ilike.${pattern},location_city.ilike.${pattern}`)
    .order("created_at", { ascending: false })
    .limit(24);

  if (error || !groupsData?.length) return [];

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
    const oid = (g as { organizer_id?: string | null }).organizer_id ?? null;
    countByGroup[g.id] = set.size + (oid && !set.has(oid) ? 1 : 0);
  });

  return groupsData.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description ?? null,
    imageUrl: g.cover_image_url || DEFAULT_GROUP_COVER,
    locationCity: g.location_city ?? null,
    memberCount: countByGroup[g.id] ?? 0,
    isPrivate: g.privacy === true,
  }));
}

export async function getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = createClient();
  const now = new Date().toISOString();
  const pattern = toPattern(q);

  const [eventsRes, groupsRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, address, location_name")
      .gte("start_time", now)
      .or(`title.ilike.${pattern},address.ilike.${pattern},location_name.ilike.${pattern}`)
      .limit(5),
    supabase
      .from("groups")
      .select("id, name, location_city")
      .or(`name.ilike.${pattern},location_city.ilike.${pattern}`)
      .limit(5),
  ]);

  const suggestions: SearchSuggestion[] = [];
  eventsRes.data?.forEach((e) => {
    const loc = e.location_name || e.address;
    suggestions.push({
      label: loc ? `${e.title} · ${loc}` : e.title,
      type: "event",
      id: e.id,
    });
  });
  groupsRes.data?.forEach((g) => {
    suggestions.push({
      label: (g as { location_city?: string }).location_city
        ? `${g.name} · ${(g as { location_city: string }).location_city}`
        : g.name,
      type: "group",
      id: g.id,
    });
  });
  return suggestions.slice(0, 10);
}
