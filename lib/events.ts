import { createClient } from "@/lib/supabase/client";
import { canManageGroup } from "@/lib/groups";

const DEFAULT_EVENT_IMAGE =
  "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=560&h=238&fit=crop";

export type PopularEventRow = {
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

export async function getPopularEvents(limit = 8): Promise<PopularEventRow[]> {
  const supabase = createClient();
  const now = new Date().toISOString();

  let result = await supabase
    .from("events")
    .select("id, title, start_time, end_time, event_type, banner_image_url, address, location_name, event_theme_id")
    .gte("start_time", now)
    .in("privacy", ["public", "private"])
    .order("start_time", { ascending: true })
    .limit(limit * 2);
  if (result.error) {
    result = await supabase
      .from("events")
      .select("id, title, start_time, end_time, event_type, banner_image_url, address, location_name, event_theme_id")
      .gte("start_time", now)
      .order("start_time", { ascending: true })
      .limit(limit * 2);
  }
  const events = result.data;
  if (result.error || !events?.length) return [];

  const eventIds = events.map((e) => e.id);
  const { data: counts } = await supabase
    .from("event_attendees")
    .select("event_id")
    .in("event_id", eventIds);

  const countByEvent: Record<string, number> = {};
  eventIds.forEach((id) => (countByEvent[id] = 0));
  counts?.forEach((r) => {
    countByEvent[r.event_id] = (countByEvent[r.event_id] ?? 0) + 1;
  });

  const withCount = events.map((e) => ({
    ...e,
    attendee_count: countByEvent[e.id] ?? 0,
  }));

  withCount.sort((a, b) => (b.attendee_count ?? 0) - (a.attendee_count ?? 0));
  return withCount.slice(0, limit).map((e) => ({
    id: e.id,
    title: e.title,
    start_time: e.start_time,
    end_time: e.end_time ?? null,
    event_type: e.event_type,
    banner_image_url: e.banner_image_url ?? null,
    address: e.address ?? null,
    location_name: e.location_name ?? null,
    event_theme_id: e.event_theme_id ?? null,
    attendee_count: e.attendee_count ?? 0,
  }));
}

/** Upcoming events with attendee count for recommendation scoring. */
export async function getUpcomingEventsForRecommendation(limit = 100): Promise<PopularEventRow[]> {
  const supabase = createClient();
  const now = new Date().toISOString();

  let result = await supabase
    .from("events")
    .select("id, title, start_time, end_time, event_type, banner_image_url, address, location_name, event_theme_id")
    .gte("start_time", now)
    .in("privacy", ["public", "private"])
    .order("start_time", { ascending: true })
    .limit(limit);
  if (result.error) {
    result = await supabase
      .from("events")
      .select("id, title, start_time, end_time, event_type, banner_image_url, address, location_name, event_theme_id")
      .gte("start_time", now)
      .order("start_time", { ascending: true })
      .limit(limit);
  }
  const events = result.data;
  if (result.error || !events?.length) return [];

  const eventIds = events.map((e) => e.id);
  const { data: counts } = await supabase
    .from("event_attendees")
    .select("event_id")
    .in("event_id", eventIds);

  const countByEvent: Record<string, number> = {};
  eventIds.forEach((id) => (countByEvent[id] = 0));
  counts?.forEach((r) => {
    countByEvent[r.event_id] = (countByEvent[r.event_id] ?? 0) + 1;
  });

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    start_time: e.start_time,
    end_time: e.end_time ?? null,
    event_type: e.event_type,
    banner_image_url: e.banner_image_url ?? null,
    address: e.address ?? null,
    location_name: e.location_name ?? null,
    event_theme_id: e.event_theme_id ?? null,
    attendee_count: countByEvent[e.id] ?? 0,
  }));
}

export function formatEventTime(start: string, end: string | null): string {
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

export function formatEventLocation(row: { address?: string | null; location_name?: string | null }): string | null {
  if (row.location_name) return row.location_name;
  if (row.address) {
    const a = row.address.trim().toLowerCase();
    if (a === "remote" || a === "온라인") return "Online";
    return row.address;
  }
  return null;
}

export type EventCardData = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  eventType: "Lightning" | "Regular" | "Special";
  imageUrl: string;
  location?: string;
};

export function popularEventToCardData(row: PopularEventRow): EventCardData {
  const endTime = row.end_time
    ? new Date(row.end_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";
  return {
    id: row.id,
    title: row.title,
    startTime: formatEventTime(row.start_time, row.end_time),
    endTime: endTime,
    eventType: (row.event_type as "Lightning" | "Regular" | "Special") || "Regular",
    imageUrl: row.banner_image_url || DEFAULT_EVENT_IMAGE,
    location: formatEventLocation(row) ?? undefined,
  };
}

export type EventListItem = EventCardData & {
  categoryName: string;
  /** Display name (name_ko ?? name) for UI. */
  categoryDisplayName: string;
  start_time: string;
  is_boosted: boolean;
};

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop";

export type EventDetailData = {
  id: string;
  title: string;
  theme: string;
  /** Category display name (name_ko ?? name) for UI. */
  themeDisplayName: string;
  eventType: "Lightning" | "Regular" | "Special";
  bannerImageUrl: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  locationName?: string;
  address?: string;
  /** Video/call link for online events. Shown when exclusive or when user has RSVP'd. */
  meeting_url?: string | null;
  /** public | private | exclusive */
  privacy: string;
  /** Whether the current user has RSVP'd (used to show meeting link for public/private). */
  hasRsvped: boolean;
  description: string;
  hostGroupId: string;
  hostGroupName: string;
  hostGroupImageUrl: string;
  hostNames: string[];
  hostAvatarUrls: string[];
  attendeeCount: number;
  attendeeAvatarUrls: string[];
  attendeeNames: string[];
  attendeeProfiles: { user_id: string; full_name: string | null; avatar_url: string | null }[];
  cancelled_at: string | null;
  photoUrls: string[];
  /** When true, event repeats (daily/weekly/monthly). */
  isRecurring?: boolean;
  /** Next up to 5 occurrence start times (ISO). For RSVP date picker. */
  nextOccurrences?: { startTime: string; label: string }[];
};

/** Get week-of-month 1-4 or 5 (last). */
function getWeekOfMonth(d: Date): number {
  const day = d.getDate();
  const weekday = d.getDay();
  let n = 0;
  for (let i = 1; i <= day; i++) {
    if (new Date(d.getFullYear(), d.getMonth(), i).getDay() === weekday) n++;
  }
  if (n <= 4) return n;
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  for (let i = day + 1; i <= lastDay; i++) {
    if (new Date(d.getFullYear(), d.getMonth(), i).getDay() === weekday) return 4;
  }
  return 5;
}

/** Next N occurrence start times for a recurring event. */
export function getNextOccurrences(
  startTimeIso: string,
  endTimeIso: string | null,
  interval: "daily" | "weekly" | "monthly",
  recurrenceWeekday: number | null,
  recurrenceWeekOfMonth: number | null,
  count = 5
): { startTime: string; label: string }[] {
  const start = new Date(startTimeIso);
  const now = new Date();
  const out: { startTime: string; label: string }[] = [];

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  if (interval === "daily") {
    let base = new Date(start);
    base.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
    if (base.getTime() < now.getTime()) {
      base = new Date(now);
      base.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
      if (base.getTime() < now.getTime()) base.setDate(base.getDate() + 1);
    }
    for (let i = 0; i < count; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      out.push({ startTime: d.toISOString(), label: fmt(d) });
    }
    return out;
  }

  if (interval === "weekly") {
    const targetWeekday = recurrenceWeekday ?? start.getDay();
    const d = new Date(now);
    d.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
    let diff = targetWeekday - d.getDay();
    if (diff < 0) diff += 7;
    if (diff === 0 && d.getTime() <= now.getTime()) diff = 7;
    d.setDate(d.getDate() + diff);
    for (let i = 0; i < count; i++) {
      const next = new Date(d);
      next.setDate(d.getDate() + i * 7);
      out.push({ startTime: next.toISOString(), label: fmt(next) });
    }
    return out;
  }

  if (interval === "monthly") {
    const targetWeekOfMonth = recurrenceWeekOfMonth ?? getWeekOfMonth(start);
    const targetWeekday = recurrenceWeekday ?? start.getDay();
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let m = 0; m < 24; m++) {
      const cand = getNthWeekdayInMonth(d.getFullYear(), d.getMonth(), targetWeekOfMonth, targetWeekday);
      if (cand) {
        cand.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
        if (cand.getTime() >= now.getTime() && out.length < count) {
          out.push({ startTime: cand.toISOString(), label: fmt(cand) });
          if (out.length >= count) break;
        }
      }
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }

  return out;
}

export function getNthWeekdayInMonth(
  year: number,
  month: number,
  weekOfMonth: number,
  weekday: number
): Date | null {
  if (weekOfMonth === 5) {
    const last = new Date(year, month + 1, 0);
    const d = new Date(last);
    while (d.getDay() !== weekday) {
      d.setDate(d.getDate() - 1);
      if (d.getMonth() !== month) return null;
    }
    return d;
  }
  let n = 0;
  const days = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= days; day++) {
    const d = new Date(year, month, day);
    if (d.getDay() === weekday) {
      n++;
      if (n === weekOfMonth) return d;
    }
  }
  return null;
}

/** Single event by ID for the detail page. */
export async function getEventById(id: string): Promise<EventDetailData | null> {
  const supabase = createClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(`
      id,
      title,
      description,
      start_time,
      end_time,
      event_type,
      banner_image_url,
      address,
      location_name,
      meeting_url,
      host_group_id,
      event_theme_id,
      cancelled_at,
      privacy,
      is_recurring,
      recurrence_interval,
      recurrence_weekday,
      recurrence_week_of_month,
      categories!event_theme_id(name, name_ko)
    `)
    .eq("id", id)
    .single();

  if (eventError || !event) return null;

  const privacy = (event as { privacy?: string | null }).privacy ?? "public";
  if (privacy === "exclusive") {
    const hostGroupId = event.host_group_id as string | null;
    if (hostGroupId) {
      const { data: { user } } = await supabase.auth.getUser();
      const viewerId = user?.id ?? null;
      if (!viewerId) return null;
      const { data: member } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", hostGroupId)
        .eq("user_id", viewerId)
        .maybeSingle();
      const { data: org } = await supabase
        .from("groups")
        .select("organizer_id")
        .eq("id", hostGroupId)
        .single();
      const isOrganizer = (org?.organizer_id as string | null) === viewerId;
      if (!member && !isOrganizer) return null;
    }
  }

  const categories = event.categories as { name: string; name_ko?: string | null }[] | { name: string; name_ko?: string | null } | null;
  const cat = Array.isArray(categories) ? categories[0] : categories;
  const theme = cat?.name ?? "Uncategorized";
  const themeDisplayName = (cat?.name_ko?.trim() || cat?.name) ?? theme;
  const hostGroupId = event.host_group_id as string | null;

  let hostGroupName = "";
  let hostGroupImageUrl = "";
  let hostGroupOrganizerId: string | null = null;
  if (hostGroupId) {
    const { data: group } = await supabase
      .from("groups")
      .select("name, cover_image_url, organizer_id")
      .eq("id", hostGroupId)
      .single();
    hostGroupName = group?.name ?? "";
    hostGroupImageUrl = group?.cover_image_url || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=96&h=96&fit=crop";
    hostGroupOrganizerId = (group as { organizer_id?: string | null })?.organizer_id ?? null;
  }

  const { data: hosts } = await supabase
    .from("event_hosts")
    .select("user_id")
    .eq("event_id", id)
    .order("display_order");

  let hostUserIds = (hosts ?? []).map((h) => h.user_id);
  if (hostUserIds.length === 0 && hostGroupOrganizerId) {
    hostUserIds = [hostGroupOrganizerId];
  }
  let hostNames: string[] = [];
  if (hostUserIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("full_name")
      .in("id", hostUserIds);
    hostNames = (users ?? []).map((u) => u.full_name || "Host");
  }
  if (hostNames.length === 0 && hostGroupName) hostNames = [hostGroupName];

  const { data: { user } } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const { data: attendees } = await supabase
    .from("event_attendees")
    .select("user_id")
    .eq("event_id", id)
    .order("joined_at", { ascending: true });

  const attendeeUserIds = (attendees ?? []).map((a) => a.user_id);
  const hasRsvped = !!viewerId && attendeeUserIds.includes(viewerId);
  const orderedAttendeeIds = [
    ...hostUserIds,
    ...attendeeUserIds.filter((uid) => !hostUserIds.includes(uid)),
  ];
  const attendeeCount = orderedAttendeeIds.length;

  let attendeeNames: string[] = [];
  let attendeeProfiles: { user_id: string; full_name: string | null; avatar_url: string | null }[] = [];
  let attendeeAvatarUrls: string[] = [];
  if (orderedAttendeeIds.length > 0) {
    const { data: attendeeUsers } = await supabase
      .from("users")
      .select("id, full_name, avatar_url")
      .in("id", orderedAttendeeIds);
    const byId = new Map(
      (attendeeUsers ?? []).map((u) => [
        u.id,
        {
          user_id: u.id,
          full_name: (u as { full_name: string | null }).full_name ?? "Someone",
          avatar_url: (u as { avatar_url: string | null }).avatar_url ?? null,
        },
      ])
    );
    attendeeProfiles = orderedAttendeeIds.map(
      (uid) => byId.get(uid) ?? { user_id: uid, full_name: "Someone", avatar_url: null }
    );
    attendeeNames = attendeeProfiles.map((p) => p.full_name ?? "Someone");
    attendeeAvatarUrls = attendeeProfiles
      .slice(0, 5)
      .map((p) => p.avatar_url || DEFAULT_AVATAR);
  }
  if (attendeeAvatarUrls.length < 5 && attendeeCount > attendeeAvatarUrls.length) {
    attendeeAvatarUrls = [...attendeeAvatarUrls, ...Array(5 - attendeeAvatarUrls.length).fill(DEFAULT_AVATAR)];
  }

  const { data: photos } = await supabase
    .from("event_photos")
    .select("image_url")
    .eq("event_id", id)
    .order("display_order");
  const photoUrls = (photos ?? []).map((p) => p.image_url).filter(Boolean);

  const startTimeStr = formatEventTime(event.start_time, event.end_time);
  const endTimeStr = event.end_time
    ? new Date(event.end_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";
  const isRecurring = !!(event as { is_recurring?: boolean }).is_recurring;
  const recurrenceInterval = (event as { recurrence_interval?: string | null }).recurrence_interval as "daily" | "weekly" | "monthly" | null;
  const recurrenceWeekday = (event as { recurrence_weekday?: number | null }).recurrence_weekday ?? null;
  const recurrenceWeekOfMonth = (event as { recurrence_week_of_month?: number | null }).recurrence_week_of_month ?? null;
  const nextOccurrences =
    isRecurring && recurrenceInterval
      ? getNextOccurrences(
          event.start_time,
          event.end_time,
          recurrenceInterval,
          recurrenceWeekday,
          recurrenceWeekOfMonth,
          5
        )
      : undefined;

  return {
    id: event.id,
    title: event.title,
    theme,
    themeDisplayName,
    eventType: (event.event_type as "Lightning" | "Regular" | "Special") || "Regular",
    bannerImageUrl: event.banner_image_url || DEFAULT_EVENT_IMAGE,
    startTime: startTimeStr,
    endTime: endTimeStr,
    locationName: event.location_name ?? undefined,
    address: event.address ?? undefined,
    meeting_url: (event as { meeting_url?: string | null }).meeting_url ?? null,
    privacy: (event as { privacy?: string }).privacy ?? "public",
    hasRsvped,
    isRecurring: nextOccurrences ? true : false,
    nextOccurrences,
    description: event.description ?? "",
    hostGroupId: hostGroupId ?? "",
    hostGroupName,
    hostGroupImageUrl,
    hostNames,
    hostAvatarUrls: hostNames.map(() => DEFAULT_AVATAR),
    attendeeCount,
    attendeeAvatarUrls,
    attendeeNames,
    attendeeProfiles,
    cancelled_at: (event as { cancelled_at?: string | null }).cancelled_at ?? null,
    photoUrls,
  };
}

/** Cancel an event (managers only). Event stays visible with "cancelled" banner; boosted status cleared. */
export async function cancelEvent(
  eventId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  if (!(await canManageEvent(eventId, userId)))
    return { ok: false, error: "You cannot cancel this event." };
  const { error } = await supabase
    .from("events")
    .update({
      cancelled_at: new Date().toISOString(),
      is_boosted: false,
      boosted_until: null,
    })
    .eq("id", eventId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type CalendarEventRow = {
  id: string;
  title: string;
  date: string;
  eventType: "Lightning" | "Regular" | "Special";
  isRecurring: boolean;
  categoryName?: string | null;
  categoryDisplayName?: string | null;
};

export type CalendarFilters = {
  categoryId?: string | null;
  location?: string | null;
};

/** Upcoming events for the calendar view. Exclusive events are always filtered out. */
export async function getCalendarEvents(
  startDate: Date,
  endDate: Date,
  filters: CalendarFilters
): Promise<CalendarEventRow[]> {
  const supabase = createClient();
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  let query = supabase
    .from("events")
    .select("id, title, start_time, event_type, is_recurring, event_theme_id, address, location_name, categories!event_theme_id(name, name_ko)")
    .gte("start_time", startIso)
    .lte("start_time", endIso)
    .in("privacy", ["public", "private"])
    .order("start_time", { ascending: true });

  if (filters.categoryId?.trim()) {
    query = query.eq("event_theme_id", filters.categoryId.trim());
  }
  if (filters.location?.trim()) {
    const loc = filters.location.trim();
    query = query.or(`address.ilike.%${loc}%,location_name.ilike.%${loc}%`);
  }

  let result = await query;
  if (result.error) {
    query = supabase
      .from("events")
      .select("id, title, start_time, event_type, is_recurring, event_theme_id, address, location_name, categories!event_theme_id(name, name_ko)")
      .gte("start_time", startIso)
      .lte("start_time", endIso)
      .order("start_time", { ascending: true });
    if (filters.categoryId?.trim()) query = query.eq("event_theme_id", filters.categoryId.trim());
    if (filters.location?.trim()) {
      const loc = filters.location.trim();
      query = query.or(`address.ilike.%${loc}%,location_name.ilike.%${loc}%`);
    }
    result = await query;
  }
  const events = result.data;
  if (result.error || !events?.length) return [];

  return events.map((e) => {
    const d = new Date(e.start_time);
    const date =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");
    const raw = e as { categories?: { name: string; name_ko?: string | null } | { name: string; name_ko?: string | null }[] | null };
    const cat = Array.isArray(raw.categories) ? raw.categories[0] : raw.categories;
    const categoryName = cat?.name ?? null;
    const categoryDisplayName = (cat?.name_ko?.trim() || cat?.name) ?? categoryName;
    return {
      id: e.id,
      title: e.title,
      date,
      eventType: (e.event_type as "Lightning" | "Regular" | "Special") || "Regular",
      isRecurring: e.is_recurring ?? false,
      categoryName,
      categoryDisplayName: categoryDisplayName ?? undefined,
    };
  });
}

/** Upcoming events for the homepage calendar (next N days). Kept for backward compatibility. */
export async function getUpcomingEventsForCalendar(
  daysAhead = 35
): Promise<CalendarEventRow[]> {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + daysAhead);
  return getCalendarEvents(now, end, {});
}

/** Upcoming events for list page with category name (for filtering). */
export async function getEventsList(): Promise<EventListItem[]> {
  const supabase = createClient();
  const now = new Date().toISOString();

  let result = await supabase
    .from("events")
    .select("id, title, start_time, end_time, event_type, banner_image_url, address, location_name, event_theme_id, is_boosted, boosted_until, categories!event_theme_id(name, name_ko)")
    .gte("start_time", now)
    .in("privacy", ["public", "private"])
    .order("start_time", { ascending: true });
  if (result.error) {
    result = await supabase
      .from("events")
      .select("id, title, start_time, end_time, event_type, banner_image_url, address, location_name, event_theme_id, is_boosted, boosted_until, categories!event_theme_id(name, name_ko)")
      .gte("start_time", now)
      .order("start_time", { ascending: true });
  }
  const events = result.data;
  if (result.error || !events?.length) return [];

  const today = new Date().toISOString().slice(0, 10);
  return events.map((e) => {
    const cats = e.categories as { name: string; name_ko?: string | null }[] | { name: string; name_ko?: string | null } | null;
    const cat = Array.isArray(cats) ? cats[0] : cats;
    const categoryName = cat?.name ?? "Uncategorized";
    const categoryDisplayName = (cat?.name_ko?.trim() || cat?.name) ?? categoryName;
    const endTime = e.end_time
      ? new Date(e.end_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : "";
    const until = (e as { boosted_until?: string | null }).boosted_until ?? null;
    const effectiveBoosted = (e.is_boosted ?? false) && (!until || until >= today);
    return {
      id: e.id,
      title: e.title,
      startTime: formatEventTime(e.start_time, e.end_time),
      endTime,
      eventType: (e.event_type as "Lightning" | "Regular" | "Special") || "Regular",
      imageUrl: e.banner_image_url || DEFAULT_EVENT_IMAGE,
      location: formatEventLocation(e) ?? undefined,
      categoryName,
      categoryDisplayName,
      start_time: e.start_time,
      is_boosted: effectiveBoosted,
    };
  });
}

/** Events the user can manage (for boost request form). */
export async function getEventsUserCanManage(userId: string): Promise<{ id: string; title: string }[]> {
  const supabase = createClient();
  const { getGroupsUserCanManage } = await import("@/lib/groups");
  const managedGroups = await getGroupsUserCanManage(userId);
  const groupIds = managedGroups.map((g) => g.id);
  const [eventsViaGroup, eventAdminRows] = await Promise.all([
    groupIds.length > 0
      ? supabase.from("events").select("id, title").in("host_group_id", groupIds).order("start_time", { ascending: false })
      : { data: [] },
    supabase.from("event_admins").select("event_id").eq("user_id", userId),
  ]);
  const adminEventIds = (eventAdminRows.data ?? []).map((r) => r.event_id);
  const byId = new Map((eventsViaGroup.data ?? []).map((e) => [e.id, { id: e.id, title: (e as { title: string }).title }]));
  if (adminEventIds.length > 0) {
    const { data: adminEvents } = await supabase.from("events").select("id, title").in("id", adminEventIds);
    (adminEvents ?? []).forEach((e) => byId.set(e.id, { id: e.id, title: (e as { title: string }).title }));
  }
  return Array.from(byId.values()).sort((a, b) => a.title.localeCompare(b.title));
}

/** Events the user is hosting or attending (for My Events page). Includes canManage (group owner/admin or event admin) for Owner pill and Manage button. */
export async function getMyEvents(userId: string): Promise<
  { id: string; title: string; start_time: string; banner_image_url: string | null; isHost: boolean; canManage: boolean }[]
> {
  const supabase = createClient();
  const [hostRows, attendeeRows] = await Promise.all([
    supabase.from("event_hosts").select("event_id").eq("user_id", userId),
    supabase.from("event_attendees").select("event_id").eq("user_id", userId),
  ]);
  const hostIds = new Set((hostRows.data ?? []).map((r) => r.event_id));
  const attendeeIds = (attendeeRows.data ?? []).map((r) => r.event_id);
  const allIds = Array.from(new Set([...hostIds, ...attendeeIds]));
  if (allIds.length === 0) return [];
  const managedIds = new Set((await getEventsUserCanManage(userId)).map((e) => e.id));
  const { data: events } = await supabase
    .from("events")
    .select("id, title, start_time, banner_image_url")
    .in("id", allIds)
    .order("start_time", { ascending: false });
  return (events ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    start_time: e.start_time,
    banner_image_url: e.banner_image_url ?? null,
    isHost: hostIds.has(e.id),
    canManage: managedIds.has(e.id),
  }));
}

/** True if the user can manage this event (owner or admin of the host group, or event admin). */
export async function canManageEvent(eventId: string, userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data: event } = await supabase
    .from("events")
    .select("host_group_id")
    .eq("id", eventId)
    .single();
  if (!event) return false;
  const hostGroupId = event.host_group_id as string | null;
  if (hostGroupId && await canManageGroup(hostGroupId, userId)) return true;
  const { data: eventAdmin } = await supabase
    .from("event_admins")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!eventAdmin;
}

export type EventForEdit = {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string | null;
  event_type: "Lightning" | "Regular" | "Special";
  event_theme_id: string;
  location_name: string | null;
  address: string | null;
  meeting_url: string | null;
  banner_image_url: string | null;
  host_group_id: string | null;
  cancelled_at: string | null;
  privacy: "public" | "private" | "exclusive";
};

export type EventAttendeeRow = { user_id: string; full_name: string | null; isHost?: boolean };

/** Attendees for event admin (list + remove). Includes hosts first (event_hosts or host group organizer), then other attendees. */
export async function getEventAttendees(eventId: string): Promise<EventAttendeeRow[]> {
  const supabase = createClient();
  const [hostsRes, attendeesRes, eventRes] = await Promise.all([
    supabase.from("event_hosts").select("user_id").eq("event_id", eventId).order("display_order"),
    supabase.from("event_attendees").select("user_id").eq("event_id", eventId).order("joined_at", { ascending: true }),
    supabase.from("events").select("host_group_id").eq("id", eventId).single(),
  ]);
  let hostUserIds = (hostsRes.data ?? []).map((r) => r.user_id);
  if (hostUserIds.length === 0) {
    const hostGroupId = (eventRes.data as { host_group_id?: string | null } | null)?.host_group_id ?? null;
    if (hostGroupId) {
      const { data: group } = await supabase
        .from("groups")
        .select("organizer_id")
        .eq("id", hostGroupId)
        .single();
      const organizerId = (group as { organizer_id?: string | null } | null)?.organizer_id ?? null;
      if (organizerId) hostUserIds = [organizerId];
    }
  }
  const attendeeUserIds = (attendeesRes.data ?? []).map((r) => r.user_id);
  const orderedIds = [
    ...hostUserIds,
    ...attendeeUserIds.filter((uid) => !hostUserIds.includes(uid)),
  ];
  if (orderedIds.length === 0) return [];
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", orderedIds);
  const byId = new Map((users ?? []).map((u) => [u.id, (u as { full_name: string | null }).full_name ?? null]));
  const hostSet = new Set(hostUserIds);
  return orderedIds.map((user_id) => ({
    user_id,
    full_name: byId.get(user_id) ?? null,
    isHost: hostSet.has(user_id),
  }));
}

/** Event row for admin edit form (raw DB fields). */
export async function getEventForEdit(eventId: string): Promise<EventForEdit | null> {
  const supabase = createClient();
  const { data: event, error } = await supabase
    .from("events")
    .select("id, title, description, start_time, end_time, event_type, event_theme_id, location_name, address, meeting_url, banner_image_url, host_group_id, cancelled_at, privacy")
    .eq("id", eventId)
    .single();

  if (error || !event) return null;

  const privacy = (event as { privacy?: string | null }).privacy ?? "public";
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    start_time: event.start_time,
    end_time: event.end_time ?? null,
    event_type: (event.event_type as "Lightning" | "Regular" | "Special") || "Regular",
    event_theme_id: event.event_theme_id ?? "",
    location_name: event.location_name ?? null,
    address: event.address ?? null,
    meeting_url: (event as { meeting_url?: string | null }).meeting_url ?? null,
    banner_image_url: event.banner_image_url ?? null,
    host_group_id: event.host_group_id ?? null,
    cancelled_at: (event as { cancelled_at?: string | null }).cancelled_at ?? null,
    privacy: privacy === "private" ? "private" : privacy === "exclusive" ? "exclusive" : "public",
  };
}
