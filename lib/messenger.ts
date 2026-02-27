import { createClient } from "@/lib/supabase/client";

export type ConversationRow = {
  id: string;
  created_at: string;
  updated_at: string;
  group_id: string | null;
  event_id: string | null;
  member_user_id: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

/** List item for "my conversations" (member view): one per group or event. */
export type ConversationListItem = {
  id: string;
  updated_at: string;
  group_id: string | null;
  event_id: string | null;
  group_name?: string | null;
  event_title?: string | null;
  last_message_preview: string | null;
  /** For member: label is "Organizers of {group/event}". For organizer list we use member name. */
  label: string;
};

/** Organizer view: conversations for a group or event, with member info. */
export type OrganizerConversationItem = {
  id: string;
  updated_at: string;
  member_user_id: string;
  member_name: string | null;
  last_message_preview: string | null;
  group_id: string | null;
  event_id: string | null;
};

export type MessageWithSender = MessageRow & {
  sender_name: string | null;
};

/** Create or get existing conversation. Only the member can call this (e.g. from "Message organizer"). */
export async function createOrGetConversation(
  opts: { groupId?: string; eventId?: string; memberUserId: string }
): Promise<{ ok: true; conversationId: string; created: boolean } | { ok: false; error: string }> {
  const { groupId, eventId, memberUserId } = opts;
  if ((groupId && eventId) || (!groupId && !eventId)) {
    return { ok: false, error: "Provide exactly one of groupId or eventId." };
  }
  const supabase = createClient();
  const { data: existing } = groupId
    ? await supabase.from("conversations").select("id").eq("group_id", groupId).eq("member_user_id", memberUserId).maybeSingle()
    : await supabase.from("conversations").select("id").eq("event_id", eventId!).eq("member_user_id", memberUserId).maybeSingle();
  const row = existing;
  if (row) {
    return { ok: true, conversationId: (row as { id: string }).id, created: false };
  }
  const { data: inserted, error } = await supabase
    .from("conversations")
    .insert({
      group_id: groupId ?? null,
      event_id: eventId ?? null,
      member_user_id: memberUserId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, conversationId: (inserted as { id: string }).id, created: true };
}

/** Conversations for the current user as member (their "inbox" of threads with organizers). */
export async function getConversationsForUser(userId: string): Promise<ConversationListItem[]> {
  const supabase = createClient();
  const { data: convos, error } = await supabase
    .from("conversations")
    .select("id, updated_at, group_id, event_id, member_user_id")
    .eq("member_user_id", userId)
    .order("updated_at", { ascending: false });
  if (error || !convos?.length) return [];
  const groupIds = [...new Set((convos as ConversationRow[]).map((c) => c.group_id).filter(Boolean))] as string[];
  const eventIds = [...new Set((convos as ConversationRow[]).map((c) => c.event_id).filter(Boolean))] as string[];
  const [groupsRes, eventsRes, lastMessages] = await Promise.all([
    groupIds.length ? supabase.from("groups").select("id, name").in("id", groupIds) : { data: [] },
    eventIds.length ? supabase.from("events").select("id, title").in("id", eventIds) : { data: [] },
    getLastMessagePreviews(convos.map((c) => c.id)),
  ]);
  const groupNames = new Map((groupsRes.data ?? []).map((g: { id: string; name: string }) => [g.id, g.name]));
  const eventTitles = new Map((eventsRes.data ?? []).map((e: { id: string; title: string }) => [e.id, e.title]));
  return (convos as ConversationRow[]).map((c) => {
    const label = c.group_id
      ? `Organizers of ${groupNames.get(c.group_id) ?? "Group"}`
      : `Organizers of ${eventTitles.get(c.event_id!) ?? "Event"}`;
    return {
      id: c.id,
      updated_at: c.updated_at,
      group_id: c.group_id,
      event_id: c.event_id,
      group_name: c.group_id ? groupNames.get(c.group_id) ?? null : null,
      event_title: c.event_id ? eventTitles.get(c.event_id) ?? null : null,
      last_message_preview: lastMessages.get(c.id) ?? null,
      label,
    };
  });
}

/** Single query: latest message per conversation (avoids N+1). */
async function getLastMessagePreviews(
  conversationIds: string[]
): Promise<Map<string, string>> {
  if (!conversationIds.length) return new Map();
  const supabase = createClient();
  // Fetch recent messages for all conversations; we'll keep the latest per conversation.
  const { data: rows } = await supabase
    .from("messages")
    .select("conversation_id, content")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(Math.max(500, conversationIds.length * 20));
  const result = new Map<string, string>();
  for (const r of rows ?? []) {
    const cid = (r as { conversation_id: string }).conversation_id;
    if (!result.has(cid)) {
      const content = (r as { content?: string }).content ?? "";
      result.set(cid, content.length > 80 ? content.slice(0, 80) + "…" : content);
    }
  }
  conversationIds.forEach((cid) => {
    if (!result.has(cid)) result.set(cid, "");
  });
  return result;
}

/** Conversations for a group (organizer view). Only call if user can manage group. */
export async function getConversationsForGroup(groupId: string): Promise<OrganizerConversationItem[]> {
  const supabase = createClient();
  const { data: convos, error } = await supabase
    .from("conversations")
    .select("id, updated_at, member_user_id")
    .eq("group_id", groupId)
    .order("updated_at", { ascending: false });
  if (error || !convos?.length) return [];
  const memberIds = [...new Set((convos as { member_user_id: string }[]).map((c) => c.member_user_id))];
  const { data: users } = await supabase.from("users").select("id, full_name").in("id", memberIds);
  const nameById = new Map((users ?? []).map((u) => [u.id, (u as { full_name: string | null }).full_name ?? null]));
  const lastMessages = await getLastMessagePreviews(convos.map((c) => c.id));
  return (convos as { id: string; updated_at: string; member_user_id: string }[]).map((c) => ({
    id: c.id,
    updated_at: c.updated_at,
    member_user_id: c.member_user_id,
    member_name: nameById.get(c.member_user_id) ?? null,
    last_message_preview: lastMessages.get(c.id) ?? null,
    group_id: groupId,
    event_id: null as string | null,
  }));
}

/** Conversations for an event (organizer view). Only call if user can manage event. */
export async function getConversationsForEvent(eventId: string): Promise<OrganizerConversationItem[]> {
  const supabase = createClient();
  const { data: convos, error } = await supabase
    .from("conversations")
    .select("id, updated_at, member_user_id")
    .eq("event_id", eventId)
    .order("updated_at", { ascending: false });
  if (error || !convos?.length) return [];
  const memberIds = [...new Set((convos as { member_user_id: string }[]).map((c) => c.member_user_id))];
  const { data: users } = await supabase.from("users").select("id, full_name").in("id", memberIds);
  const nameById = new Map((users ?? []).map((u) => [u.id, (u as { full_name: string | null }).full_name ?? null]));
  const lastMessages = await getLastMessagePreviews(convos.map((c) => c.id));
  return (convos as { id: string; updated_at: string; member_user_id: string }[]).map((c) => ({
    id: c.id,
    updated_at: c.updated_at,
    member_user_id: c.member_user_id,
    member_name: nameById.get(c.member_user_id) ?? null,
    last_message_preview: lastMessages.get(c.id) ?? null,
    group_id: null as string | null,
    event_id: eventId,
  }));
}

/** Single conversation by id. Returns null if not found or no access. */
export async function getConversationById(conversationId: string): Promise<{
  id: string;
  group_id: string | null;
  event_id: string | null;
  member_user_id: string;
  group_name?: string | null;
  event_title?: string | null;
  member_name?: string | null;
} | null> {
  const supabase = createClient();
  const { data: c, error } = await supabase
    .from("conversations")
    .select("id, group_id, event_id, member_user_id")
    .eq("id", conversationId)
    .single();
  if (error || !c) return null;
  const row = c as ConversationRow;
  let groupName: string | null = null;
  let eventTitle: string | null = null;
  if (row.group_id) {
    const { data: g } = await supabase.from("groups").select("name").eq("id", row.group_id).single();
    groupName = (g as { name?: string } | null)?.name ?? null;
  }
  if (row.event_id) {
    const { data: e } = await supabase.from("events").select("title").eq("id", row.event_id).single();
    eventTitle = (e as { title?: string } | null)?.title ?? null;
  }
  const { data: u } = await supabase.from("users").select("full_name").eq("id", row.member_user_id).single();
  const memberName = (u as { full_name?: string | null } | null)?.full_name ?? null;
  return {
    id: row.id,
    group_id: row.group_id,
    event_id: row.event_id,
    member_user_id: row.member_user_id,
    group_name: groupName,
    event_title: eventTitle,
    member_name: memberName,
  };
}

const MESSAGES_PAGE_SIZE = 50;

/** Messages in a conversation, newest first. Pass cursor (created_at of oldest message you have) to load older. */
export async function getMessages(
  conversationId: string,
  opts?: { limit?: number; cursor?: string }
): Promise<{ messages: MessageWithSender[]; nextCursor: string | null }> {
  const limit = opts?.limit ?? MESSAGES_PAGE_SIZE;
  const supabase = createClient();
  let query = supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (opts?.cursor) {
    query = query.lt("created_at", opts.cursor);
  }
  const { data: messages, error } = await query;
  if (error) return { messages: [], nextCursor: null };
  const rows = (messages ?? []) as MessageRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].created_at : null;
  // Return oldest-first for display (reverse the page)
  const ordered = [...page].reverse();
  const senderIds = [...new Set(ordered.map((m) => m.sender_id))];
  const { data: users } = await supabase.from("users").select("id, full_name").in("id", senderIds);
  const nameById = new Map((users ?? []).map((u) => [u.id, (u as { full_name: string | null }).full_name ?? null]));
  const messagesWithSender: MessageWithSender[] = ordered.map((m) => ({
    ...m,
    sender_name: nameById.get(m.sender_id) ?? null,
  }));
  return { messages: messagesWithSender, nextCursor };
}

/** Send a message. Caller must be participant (member or organizer). */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, error: "Message cannot be empty." };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, content: trimmed })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, messageId: (data as { id: string }).id };
}

/** Mark a conversation as read for the current user (call when opening the thread). */
export async function markConversationRead(
  userId: string,
  conversationId: string
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("conversation_reads")
    .upsert({ user_id: userId, conversation_id: conversationId, read_at: new Date().toISOString() }, {
      onConflict: "user_id,conversation_id",
    });
}

export type UnreadCounts = {
  total: number;
  messagesUnread: number;
  groupsUnread: number;
  eventsUnread: number;
  byGroup: Record<string, number>;
  byEvent: Record<string, number>;
};

/** Last message metadata per conversation (for unread logic). */
async function getLastMessageMeta(
  conversationIds: string[]
): Promise<Map<string, { created_at: string; sender_id: string }>> {
  if (!conversationIds.length) return new Map();
  const supabase = createClient();
  const result = new Map<string, { created_at: string; sender_id: string }>();
  const { data: rows } = await supabase
    .from("messages")
    .select("conversation_id, created_at, sender_id")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });
  for (const r of rows ?? []) {
    const cid = (r as { conversation_id: string }).conversation_id;
    if (!result.has(cid)) {
      result.set(cid, {
        created_at: (r as { created_at: string }).created_at,
        sender_id: (r as { sender_id: string }).sender_id,
      });
    }
  }
  return result;
}

/** Unread counts for badges: as member (Messages), per managed group (My Groups / cards), per managed event (My Events / cards). */
export async function getUnreadCounts(userId: string): Promise<UnreadCounts> {
  const supabase = createClient();
  const { getGroupsUserCanManage } = await import("@/lib/groups");
  const { getEventsUserCanManage } = await import("@/lib/events");
  const [managedGroups, managedEvents, convosAsMember, convosGroup, convosEvent] = await Promise.all([
    getGroupsUserCanManage(userId),
    getEventsUserCanManage(userId),
    supabase.from("conversations").select("id, group_id, event_id").eq("member_user_id", userId),
    supabase.from("conversations").select("id, group_id, event_id").not("group_id", "is", null),
    supabase.from("conversations").select("id, group_id, event_id").not("event_id", "is", null),
  ]);
  const groupIds = new Set(managedGroups.map((g) => g.id));
  const eventIds = new Set(managedEvents.map((e) => e.id));
  const organizerConvos = [
    ...(convosGroup.data ?? []).filter((c) => c.group_id && groupIds.has(c.group_id)),
    ...(convosEvent.data ?? []).filter((c) => c.event_id && eventIds.has(c.event_id)),
  ];
  const allConvoIds = [
    ...(convosAsMember.data ?? []).map((c) => c.id),
    ...organizerConvos.map((c) => c.id),
  ];
  const uniqueConvoIds = [...new Set(allConvoIds)];
  if (uniqueConvoIds.length === 0) {
    return { total: 0, messagesUnread: 0, groupsUnread: 0, eventsUnread: 0, byGroup: {}, byEvent: {} };
  }
  const [lastMessageMeta, readRows] = await Promise.all([
    getLastMessageMeta(uniqueConvoIds),
    supabase.from("conversation_reads").select("conversation_id, read_at").eq("user_id", userId),
  ]);
  const readAtByCid = new Map((readRows.data ?? []).map((r) => [r.conversation_id, r.read_at]));
  const memberConvoIds = new Set((convosAsMember.data ?? []).map((c) => c.id));
  const groupConvosByGid = new Map<string, string[]>();
  const eventConvosByEid = new Map<string, string[]>();
  for (const c of organizerConvos) {
    if (c.group_id) {
      const list = groupConvosByGid.get(c.group_id) ?? [];
      list.push(c.id);
      groupConvosByGid.set(c.group_id, list);
    }
    if (c.event_id) {
      const list = eventConvosByEid.get(c.event_id) ?? [];
      list.push(c.id);
      eventConvosByEid.set(c.event_id, list);
    }
  }
  let messagesUnread = 0;
  const byGroup: Record<string, number> = {};
  const byEvent: Record<string, number> = {};
  for (const cid of uniqueConvoIds) {
    const last = lastMessageMeta.get(cid);
    if (!last || last.sender_id === userId) continue;
    const readAt = readAtByCid.get(cid);
    if (readAt && readAt >= last.created_at) continue;
    if (memberConvoIds.has(cid)) messagesUnread++;
    for (const [gid, list] of groupConvosByGid) {
      if (list.includes(cid)) {
        byGroup[gid] = (byGroup[gid] ?? 0) + 1;
        break;
      }
    }
    for (const [eid, list] of eventConvosByEid) {
      if (list.includes(cid)) {
        byEvent[eid] = (byEvent[eid] ?? 0) + 1;
        break;
      }
    }
  }
  const groupsUnread = Object.values(byGroup).reduce((a, b) => a + b, 0);
  const eventsUnread = Object.values(byEvent).reduce((a, b) => a + b, 0);
  const total = messagesUnread + groupsUnread + eventsUnread;
  return { total, messagesUnread, groupsUnread, eventsUnread, byGroup, byEvent };
}
