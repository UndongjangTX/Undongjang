import { createClient } from "@/lib/supabase/client";
import { getUpcomingEventsForRecommendation, formatEventTime, formatEventLocation } from "@/lib/events";
import type { UserProfile } from "@/lib/user-profile";

const DEFAULT_GROUP_COVER =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=400&fit=crop";
const DEFAULT_EVENT_IMAGE =
  "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=560&h=238&fit=crop";

export type GroupForRecommendation = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  locationCity: string | null;
  memberCount: number;
  group_category_id: string | null;
};

export type EventForRecommendation = {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  event_type: string;
  banner_image_url: string | null;
  address: string | null;
  location_name: string | null;
  event_theme_id: string | null;
  attendee_count: number;
};

export type RecommendedItem =
  | { type: "group"; score: number; group: GroupForRecommendation }
  | { type: "event"; score: number; event: EventForRecommendation };

async function getGroupsForRecommendation(): Promise<GroupForRecommendation[]> {
  const supabase = createClient();
  const { data: groupsData, error } = await supabase
    .from("groups")
    .select("id, name, description, cover_image_url, location_city, group_category_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error || !groupsData?.length) return [];

  const ids = groupsData.map((g) => g.id);
  const { data: membersData } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", ids);

  const countByGroup: Record<string, number> = {};
  ids.forEach((id) => (countByGroup[id] = 0));
  membersData?.forEach((r) => {
    countByGroup[r.group_id] = (countByGroup[r.group_id] ?? 0) + 1;
  });

  return groupsData.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description ?? null,
    imageUrl: g.cover_image_url || DEFAULT_GROUP_COVER,
    locationCity: g.location_city ?? null,
    memberCount: countByGroup[g.id] ?? 0,
    group_category_id: g.group_category_id ?? null,
  }));
}

/** Score event: interest (0–1), date sooner (0–1), location match (0–1), popularity (0–1). Weights: 0.4, 0.3, 0.2, 0.1 */
function scoreEvent(
  event: EventForRecommendation,
  profile: UserProfile | null
): number {
  const interestIds = Array.isArray(profile?.interested_categories)
    ? profile.interested_categories
    : [];
  const userCity = profile?.city_location?.trim().toLowerCase() ?? "";

  let interestScore = 0.5;
  if (interestIds.length > 0 && event.event_theme_id) {
    interestScore = interestIds.includes(event.event_theme_id) ? 1 : 0;
  }

  const now = Date.now();
  const startMs = new Date(event.start_time).getTime();
  const daysFromNow = Math.max(0, (startMs - now) / (24 * 60 * 60 * 1000));
  const dateScore = 1 / (1 + daysFromNow / 14);

  let locationScore = 0.5;
  if (userCity) {
    const loc = formatEventLocation(event)?.toLowerCase() ?? "";
    if (loc === "online" || loc === "remote") locationScore = 0.7;
    else if (loc.includes(userCity)) locationScore = 1;
  }

  const popularityScore = Math.min(1, (event.attendee_count ?? 0) / 50);

  return 0.4 * interestScore + 0.3 * dateScore + 0.2 * locationScore + 0.1 * popularityScore;
}

/** Score group: interest (0–1), popularity (0–1), location (0–1). Weights: 0.5, 0.3, 0.2 */
function scoreGroup(
  group: GroupForRecommendation,
  profile: UserProfile | null
): number {
  const interestIds = Array.isArray(profile?.interested_categories)
    ? profile.interested_categories
    : [];
  const userCity = profile?.city_location?.trim().toLowerCase() ?? "";

  let interestScore = 0.5;
  if (interestIds.length > 0 && group.group_category_id) {
    interestScore = interestIds.includes(group.group_category_id) ? 1 : 0;
  }

  const popularityScore = Math.min(1, (group.memberCount ?? 0) / 200);

  let locationScore = 0.5;
  if (userCity && group.locationCity?.toLowerCase().includes(userCity)) {
    locationScore = 1;
  }

  return 0.5 * interestScore + 0.3 * popularityScore + 0.2 * locationScore;
}

export async function getRecommendedForUser(
  profile: UserProfile | null,
  limit = 12
): Promise<RecommendedItem[]> {
  const [groups, events] = await Promise.all([
    getGroupsForRecommendation(),
    getUpcomingEventsForRecommendation(60),
  ]);

  const scored: RecommendedItem[] = [
    ...groups.map((group) => ({
      type: "group" as const,
      score: scoreGroup(group, profile),
      group,
    })),
    ...events.map((event) => ({
      type: "event" as const,
      score: scoreEvent(event, profile),
      event,
    })),
  ];

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/** Convert recommended event to EventCardData shape */
export function recommendedEventToCardData(event: EventForRecommendation): {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  eventType: "Lightning" | "Regular" | "Special";
  imageUrl: string;
  location?: string;
} {
  const endTime = event.end_time
    ? new Date(event.end_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";
  return {
    id: event.id,
    title: event.title,
    startTime: formatEventTime(event.start_time, event.end_time),
    endTime: endTime,
    eventType: (event.event_type as "Lightning" | "Regular" | "Special") || "Regular",
    imageUrl: event.banner_image_url || DEFAULT_EVENT_IMAGE,
    location: formatEventLocation(event) ?? undefined,
  };
}

/** Convert recommended group to GroupCardData shape */
export function recommendedGroupToCardData(group: GroupForRecommendation) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    imageUrl: group.imageUrl,
    locationCity: group.locationCity,
    memberCount: group.memberCount,
  };
}
