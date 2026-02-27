import { createClient } from "@/lib/supabase/client";
import { formatEventTime, formatEventLocation } from "@/lib/events";

const DEFAULT_GROUP_COVER =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=400&fit=crop";
const DEFAULT_EVENT_IMAGE =
  "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=560&h=238&fit=crop";

const RECENT_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Recency + popularity metric: 0.5 * recency_score + 0.5 * popularity_score (each 0–1). */
function recencyScore(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const daysAgo = (now - created) / MS_PER_DAY;
  return 1 / (1 + daysAgo / 14);
}

function popularityScoreGroup(memberCount: number): number {
  return Math.min(1, memberCount / 150);
}

function popularityScoreEvent(attendeeCount: number): number {
  return Math.min(1, attendeeCount / 50);
}

export type RecentlyAddedGroup = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  locationCity: string | null;
  memberCount: number;
  created_at: string;
};

export type RecentlyAddedEvent = {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  event_type: string;
  banner_image_url: string | null;
  address: string | null;
  location_name: string | null;
  attendee_count: number;
  created_at: string;
};

export type RecentlyAddedItem =
  | { type: "group"; score: number; group: RecentlyAddedGroup }
  | { type: "event"; score: number; event: RecentlyAddedEvent };

export async function getRecentlyAdded(limit = 12): Promise<RecentlyAddedItem[]> {
  const supabase = createClient();
  const cutoff = new Date(Date.now() - RECENT_DAYS * MS_PER_DAY).toISOString();

  const [groupsRes, eventsResInitial] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, description, cover_image_url, location_city, created_at, organizer_id")
      .is("deleted_at", null)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id, title, start_time, end_time, event_type, banner_image_url, address, location_name, created_at")
      .in("privacy", ["public", "private"])
      .gte("created_at", cutoff)
      .gte("start_time", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);
  let eventsRes = eventsResInitial;
  if (eventsResInitial.error) {
    const retry = await supabase
      .from("events")
      .select("id, title, start_time, end_time, event_type, banner_image_url, address, location_name, created_at")
      .gte("created_at", cutoff)
      .gte("start_time", new Date().toISOString())
      .order("created_at", { ascending: false });
    eventsRes = retry;
  }
  const groupIds = groupsRes.data?.map((g) => g.id) ?? [];
  const eventIds = eventsRes.data?.map((e) => e.id) ?? [];

  const [memberCounts, attendeeCounts] = await Promise.all([
    groupIds.length > 0
      ? supabase.from("group_members").select("group_id, user_id").in("group_id", groupIds)
      : Promise.resolve({ data: [] }),
    eventIds.length > 0
      ? supabase.from("event_attendees").select("event_id").in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
  ]);

  const memberSetByGroup: Record<string, Set<string>> = {};
  groupIds.forEach((id) => (memberSetByGroup[id] = new Set()));
  memberCounts.data?.forEach((r) => {
    memberSetByGroup[r.group_id]?.add(r.user_id);
  });
  const countByGroup: Record<string, number> = {};
  groupsRes.data?.forEach((g) => {
    const set = memberSetByGroup[g.id] ?? new Set();
    const oid = (g as { organizer_id?: string | null }).organizer_id ?? null;
    countByGroup[g.id] = set.size + (oid && !set.has(oid) ? 1 : 0);
  });
  const countByEvent: Record<string, number> = {};
  eventIds.forEach((id) => (countByEvent[id] = 0));
  attendeeCounts.data?.forEach((r) => {
    countByEvent[r.event_id] = (countByEvent[r.event_id] ?? 0) + 1;
  });

  const scored: RecentlyAddedItem[] = [];

  groupsRes.data?.forEach((g) => {
    const memberCount = countByGroup[g.id] ?? 0;
    const rec = recencyScore(g.created_at);
    const pop = popularityScoreGroup(memberCount);
    scored.push({
      type: "group",
      score: 0.5 * rec + 0.5 * pop,
      group: {
        id: g.id,
        name: g.name,
        description: g.description ?? null,
        imageUrl: g.cover_image_url || DEFAULT_GROUP_COVER,
        locationCity: g.location_city ?? null,
        memberCount,
        created_at: g.created_at,
      },
    });
  });

  eventsRes.data?.forEach((e) => {
    const attendee_count = countByEvent[e.id] ?? 0;
    const rec = recencyScore(e.created_at);
    const pop = popularityScoreEvent(attendee_count);
    scored.push({
      type: "event",
      score: 0.5 * rec + 0.5 * pop,
      event: {
        id: e.id,
        title: e.title,
        start_time: e.start_time,
        end_time: e.end_time ?? null,
        event_type: e.event_type,
        banner_image_url: e.banner_image_url ?? null,
        address: e.address ?? null,
        location_name: e.location_name ?? null,
        attendee_count,
        created_at: e.created_at,
      },
    });
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export function recentlyAddedEventToCardData(event: RecentlyAddedEvent) {
  const endTime = event.end_time
    ? new Date(event.end_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";
  return {
    id: event.id,
    title: event.title,
    startTime: formatEventTime(event.start_time, event.end_time),
    endTime,
    eventType: (event.event_type as "Lightning" | "Regular" | "Special") || "Regular",
    imageUrl: event.banner_image_url || DEFAULT_EVENT_IMAGE,
    location: formatEventLocation(event) ?? undefined,
  };
}

export function recentlyAddedGroupToCardData(group: RecentlyAddedGroup) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    imageUrl: group.imageUrl,
    locationCity: group.locationCity,
    memberCount: group.memberCount,
  };
}
