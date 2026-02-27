import { createClient } from "@/lib/supabase/client";
import { isGroupOwner } from "@/lib/groups";

export type EventInviteRow = { id: string; email: string; created_at: string };

export async function getEventInvites(eventId: string): Promise<EventInviteRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("event_invites")
    .select("id, email, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  return (data ?? []) as EventInviteRow[];
}

/** Invite by email: if user exists, add to event_attendees; else add to event_invites. */
export async function inviteToEventByEmail(
  eventId: string,
  email: string,
  invitedByUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: false, error: "Email is required." };

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  if (user?.id) {
    const { error } = await supabase.from("event_attendees").insert({
      event_id: eventId,
      user_id: user.id,
    });
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Already attending." };
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  const { error } = await supabase.from("event_invites").insert({
    event_id: eventId,
    email: normalized,
    invited_by: invitedByUserId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function cancelEventInvite(eventId: string, inviteId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("event_invites")
    .delete()
    .eq("id", inviteId)
    .eq("event_id", eventId);
  return !error;
}

export type EventAdminRow = { id: string; user_id: string; full_name: string | null };

export async function getEventAdmins(eventId: string): Promise<EventAdminRow[]> {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("event_admins")
    .select("id, user_id")
    .eq("event_id", eventId);
  if (!rows?.length) return [];
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", rows.map((r) => r.user_id));
  const nameBy = new Map((users ?? []).map((u) => [u.id, (u as { full_name: string | null }).full_name ?? null]));
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    full_name: nameBy.get(r.user_id) ?? null,
  }));
}

/** Only host group owner can assign event admins. */
export async function createEventAdminInvite(
  eventId: string,
  ownerUserId: string,
  inviteeUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: event } = await supabase
    .from("events")
    .select("host_group_id")
    .eq("id", eventId)
    .single();
  if (!event?.host_group_id) return { ok: false, error: "Event has no host group." };
  const isOwner = await isGroupOwner(event.host_group_id, ownerUserId);
  if (!isOwner) return { ok: false, error: "Only the host group owner can assign event admins." };

  const { error } = await supabase.from("event_admin_invites").insert({
    event_id: eventId,
    user_id: inviteeUserId,
    invited_by: ownerUserId,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Already invited or already admin." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function acceptEventAdminInvite(
  inviteId: string,
  userId: string
): Promise<{ ok: true; eventId: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: invite } = await supabase
    .from("event_admin_invites")
    .select("event_id, user_id")
    .eq("id", inviteId)
    .eq("user_id", userId)
    .single();
  if (!invite) return { ok: false, error: "Invite not found or not for you." };

  const { error: insertErr } = await supabase.from("event_admins").insert({
    event_id: invite.event_id,
    user_id: invite.user_id,
  });
  if (insertErr) return { ok: false, error: insertErr.message };
  await supabase.from("event_admin_invites").delete().eq("id", inviteId);
  return { ok: true, eventId: invite.event_id };
}

export type PendingEventAdminInviteRow = { id: string; event_id: string; event_title: string };

export async function getPendingEventAdminInvitesForUser(
  userId: string
): Promise<PendingEventAdminInviteRow[]> {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("event_admin_invites")
    .select("id, event_id")
    .eq("user_id", userId);
  if (!rows?.length) return [];
  const eventIds = Array.from(new Set(rows.map((r) => r.event_id)));
  const { data: events } = await supabase
    .from("events")
    .select("id, title")
    .in("id", eventIds);
  const titleBy = new Map((events ?? []).map((e) => [e.id, (e as { title: string }).title]));
  return rows.map((r) => ({
    id: r.id,
    event_id: r.event_id,
    event_title: titleBy.get(r.event_id) ?? "Event",
  }));
}

/** Transfer event to another group. Only current host group owner can do this. */
export async function transferEventToGroup(
  eventId: string,
  newHostGroupId: string,
  actorUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: event } = await supabase
    .from("events")
    .select("host_group_id")
    .eq("id", eventId)
    .single();
  if (!event?.host_group_id) return { ok: false, error: "Event has no host group." };
  const isOwner = await isGroupOwner(event.host_group_id, actorUserId);
  if (!isOwner) return { ok: false, error: "Only the host group owner can transfer this event." };

  const { data: newGroup } = await supabase
    .from("groups")
    .select("organizer_id")
    .eq("id", newHostGroupId)
    .single();
  if (!newGroup || newGroup.organizer_id !== actorUserId)
    return { ok: false, error: "You must be the organizer of the target group." };

  const { error } = await supabase
    .from("events")
    .update({ host_group_id: newHostGroupId })
    .eq("id", eventId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** True if the current user is the host group owner (for showing transfer/assign admin). */
export async function isEventHostGroupOwner(eventId: string, userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data: event } = await supabase
    .from("events")
    .select("host_group_id")
    .eq("id", eventId)
    .single();
  if (!event?.host_group_id) return false;
  return isGroupOwner(event.host_group_id, userId);
}
