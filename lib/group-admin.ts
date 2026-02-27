import { createClient } from "@/lib/supabase/client";

export async function isMember(groupId: string, userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function requestToJoin(groupId: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("group_join_requests").upsert(
    { group_id: groupId, user_id: userId, status: "pending" },
    { onConflict: "group_id,user_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function joinGroup(groupId: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Already a member." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export type GroupMemberRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  joined_at: string;
};

export async function getGroupMembers(groupId: string): Promise<GroupMemberRow[]> {
  const supabase = createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("organizer_id, created_at")
    .eq("id", groupId)
    .single();
  const organizerId = (group as { organizer_id?: string | null } | null)?.organizer_id ?? null;
  const groupCreatedAt = (group as { created_at?: string | null } | null)?.created_at ?? new Date().toISOString();

  const { data: members, error } = await supabase
    .from("group_members")
    .select("id, user_id, joined_at")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: false });
  if (error) return [];

  const memberRows = members ?? [];
  const memberUserIds = memberRows.map((m) => m.user_id);
  const orderedUserIds: string[] = organizerId
    ? [organizerId, ...memberUserIds.filter((uid) => uid !== organizerId)]
    : [...memberUserIds];

  if (orderedUserIds.length === 0) return [];

  const { data: users } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", orderedUserIds);
  const nameByKey = new Map(
    (users ?? []).map((u) => [u.id, (u as { full_name: string | null }).full_name ?? null])
  );

  const byUserId = new Map(memberRows.map((r) => [r.user_id, r]));
  return orderedUserIds.map((user_id) => {
    const m = byUserId.get(user_id);
    if (m) {
      return {
        id: m.id,
        user_id: m.user_id,
        full_name: nameByKey.get(m.user_id) ?? null,
        joined_at: m.joined_at,
      };
    }
    return {
      id: `organizer-${user_id}`,
      user_id,
      full_name: nameByKey.get(user_id) ?? null,
      joined_at: groupCreatedAt,
    };
  });
}

/** Invite by email: find user by email and add to group_members. No acceptance required. */
export async function inviteMemberByEmail(
  groupId: string,
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: false, error: "Email is required." };

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  if (!user?.id) return { ok: false, error: "No account found with this email." };

  const { error } = await supabase.from("group_members").insert({
    group_id: groupId,
    user_id: user.id,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "This person is already a member." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Kick a member (owner/admin only). Cannot kick owner. */
export async function kickMember(
  groupId: string,
  memberUserId: string,
  actorUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("organizer_id")
    .eq("id", groupId)
    .single();
  if (!group) return { ok: false, error: "Group not found." };
  if (group.organizer_id === memberUserId)
    return { ok: false, error: "Cannot remove the group owner." };

  const { data: isAdmin } = await supabase
    .from("group_admins")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", actorUserId)
    .maybeSingle();
  const isOwner = group.organizer_id === actorUserId;
  if (!isOwner && !isAdmin) return { ok: false, error: "Not authorized." };

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberUserId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Request group deletion (owner only). Group is hidden immediately; owner can restore within 7 days. Clears boosted status. */
export async function requestGroupDeletion(
  groupId: string,
  ownerUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("organizer_id")
    .eq("id", groupId)
    .single();
  if (!group || group.organizer_id !== ownerUserId)
    return { ok: false, error: "Only the group owner can delete the group." };
  const { error } = await supabase
    .from("groups")
    .update({
      deleted_at: new Date().toISOString(),
      is_boosted: false,
      boosted_until: null,
    })
    .eq("id", groupId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Restore a group that was scheduled for deletion (owner only). */
export async function restoreGroup(
  groupId: string,
  ownerUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("organizer_id, deleted_at")
    .eq("id", groupId)
    .single();
  if (!group) return { ok: false, error: "Group not found." };
  if (group.organizer_id !== ownerUserId)
    return { ok: false, error: "Only the group owner can restore the group." };
  if (!group.deleted_at) return { ok: false, error: "Group is not scheduled for deletion." };
  const { error } = await supabase
    .from("groups")
    .update({ deleted_at: null })
    .eq("id", groupId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type JoinRequestRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  status: string;
  created_at: string;
};

export async function getJoinRequests(groupId: string): Promise<JoinRequestRow[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("group_join_requests")
    .select("id, user_id, status, created_at")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error || !rows?.length) return [];

  const userIds = rows.map((r) => r.user_id);
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", userIds);
  const nameByKey = new Map(
    (users ?? []).map((u) => [u.id, (u as { full_name: string | null }).full_name ?? null])
  );

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    full_name: nameByKey.get(r.user_id) ?? null,
    status: r.status,
    created_at: r.created_at,
  }));
}

export async function acceptJoinRequest(
  requestId: string,
  groupId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: req } = await supabase
    .from("group_join_requests")
    .select("user_id")
    .eq("id", requestId)
    .eq("group_id", groupId)
    .single();
  if (!req) return { ok: false, error: "Request not found." };

  const { error: updateErr } = await supabase
    .from("group_join_requests")
    .update({ status: "accepted" })
    .eq("id", requestId);
  if (updateErr) return { ok: false, error: updateErr.message };

  const { error: insertErr } = await supabase.from("group_members").insert({
    group_id: groupId,
    user_id: req.user_id,
  });
  if (insertErr && insertErr.code !== "23505") return { ok: false, error: insertErr.message };
  return { ok: true };
}

export async function rejectJoinRequest(
  requestId: string,
  groupId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("group_join_requests")
    .update({ status: "rejected" })
    .eq("id", requestId)
    .eq("group_id", groupId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Create ownership transfer request; to_user must accept. */
export async function createOwnershipTransfer(
  groupId: string,
  fromUserId: string,
  toUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("organizer_id")
    .eq("id", groupId)
    .single();
  if (!group || group.organizer_id !== fromUserId)
    return { ok: false, error: "Only the owner can transfer ownership." };

  const { error } = await supabase.from("group_ownership_transfer_requests").upsert(
    { group_id: groupId, from_user_id: fromUserId, to_user_id: toUserId },
    { onConflict: "group_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** To_user accepts ownership; we set organizer_id and remove request. */
export async function acceptOwnershipTransfer(
  requestId: string,
  userId: string
): Promise<{ ok: true; groupId: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: req } = await supabase
    .from("group_ownership_transfer_requests")
    .select("group_id, from_user_id, to_user_id")
    .eq("id", requestId)
    .eq("to_user_id", userId)
    .single();
  if (!req) return { ok: false, error: "Request not found or not for you." };

  const { error: updateGroup } = await supabase
    .from("groups")
    .update({ organizer_id: req.to_user_id })
    .eq("id", req.group_id);
  if (updateGroup) return { ok: false, error: updateGroup.message };

  await supabase.from("group_ownership_transfer_requests").delete().eq("id", requestId);
  return { ok: true, groupId: req.group_id };
}

/** Owner invites user to become admin; user must accept. */
export async function createAdminInvite(
  groupId: string,
  ownerUserId: string,
  inviteeUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("organizer_id")
    .eq("id", groupId)
    .single();
  if (!group || group.organizer_id !== ownerUserId)
    return { ok: false, error: "Only the owner can assign admins." };

  const { error } = await supabase.from("group_admin_invites").insert({
    group_id: groupId,
    user_id: inviteeUserId,
    invited_by: ownerUserId,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Already invited or already admin." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Owner or invitee declines ownership transfer. */
export async function declineOwnershipTransfer(
  requestId: string,
  userId: string
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("group_ownership_transfer_requests")
    .delete()
    .eq("id", requestId)
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
  return !error;
}

/** Invitee accepts admin invite. */
export async function acceptAdminInvite(
  inviteId: string,
  userId: string
): Promise<{ ok: true; groupId: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: invite } = await supabase
    .from("group_admin_invites")
    .select("group_id, user_id")
    .eq("id", inviteId)
    .eq("user_id", userId)
    .single();
  if (!invite) return { ok: false, error: "Invite not found or not for you." };

  const { error: insertErr } = await supabase.from("group_admins").insert({
    group_id: invite.group_id,
    user_id: invite.user_id,
  });
  if (insertErr) return { ok: false, error: insertErr.message };

  await supabase.from("group_admin_invites").delete().eq("id", inviteId);
  return { ok: true, groupId: invite.group_id };
}

/** Invitee or owner declines admin invite. */
export async function declineAdminInvite(inviteId: string, userId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("group_admin_invites")
    .delete()
    .eq("id", inviteId)
    .or(`user_id.eq.${userId},invited_by.eq.${userId}`);
  return !error;
}

export type PendingTransferRow = {
  id: string;
  group_id: string;
  group_name: string;
  from_user_name: string | null;
};

export async function getPendingTransfersForUser(
  userId: string
): Promise<PendingTransferRow[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("group_ownership_transfer_requests")
    .select("id, group_id, from_user_id")
    .eq("to_user_id", userId);
  if (error || !rows?.length) return [];

  const groupIds = [...new Set(rows.map((r) => r.group_id))];
  const userIds = [...new Set(rows.map((r) => r.from_user_id))];
  const [groupsRes, usersRes] = await Promise.all([
    supabase.from("groups").select("id, name").in("id", groupIds),
    supabase.from("users").select("id, full_name").in("id", userIds),
  ]);
  const groupNames = new Map(
    (groupsRes.data ?? []).map((g) => [g.id, (g as { name: string }).name])
  );
  const userNames = new Map(
    (usersRes.data ?? []).map((u) => [u.id, (u as { full_name: string | null }).full_name ?? null])
  );

  return rows.map((r) => ({
    id: r.id,
    group_id: r.group_id,
    group_name: groupNames.get(r.group_id) ?? "Group",
    from_user_name: userNames.get(r.from_user_id) ?? null,
  }));
}

export type PendingAdminInviteRow = {
  id: string;
  group_id: string;
  group_name: string;
  invited_by_name: string | null;
};

export async function getPendingAdminInvitesForUser(
  userId: string
): Promise<PendingAdminInviteRow[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("group_admin_invites")
    .select("id, group_id, invited_by")
    .eq("user_id", userId);
  if (error || !rows?.length) return [];

  const groupIds = [...new Set(rows.map((r) => r.group_id))];
  const userIds = [...new Set(rows.map((r) => r.invited_by))];
  const [groupsRes, usersRes] = await Promise.all([
    supabase.from("groups").select("id, name").in("id", groupIds),
    supabase.from("users").select("id, full_name").in("id", userIds),
  ]);
  const groupNames = new Map(
    (groupsRes.data ?? []).map((g) => [g.id, (g as { name: string }).name])
  );
  const userNames = new Map(
    (usersRes.data ?? []).map((u) => [u.id, (u as { full_name: string | null }).full_name ?? null])
  );

  return rows.map((r) => ({
    id: r.id,
    group_id: r.group_id,
    group_name: groupNames.get(r.group_id) ?? "Group",
    invited_by_name: userNames.get(r.invited_by) ?? null,
  }));
}
