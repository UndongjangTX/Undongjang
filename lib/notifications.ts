import { createClient } from "@/lib/supabase/client";

export type NotificationType =
  | "new_member_request"
  | "ownership_transfer_request"
  | "admin_invite";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  group_id: string;
  related_id: string | null;
  read_at: string | null;
  created_at: string;
  group_name?: string;
};

export async function getUnreadNotifications(
  userId: string
): Promise<NotificationRow[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("notifications")
    .select("id, user_id, type, group_id, related_id, read_at, created_at")
    .eq("user_id", userId)
    .is("read_at", null)
    .order("created_at", { ascending: false });
  if (error || !rows?.length) return [];

  const groupIds = [...new Set(rows.map((r) => r.group_id))];
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .in("id", groupIds);
  const nameByKey = new Map(
    (groups ?? []).map((g) => [g.id, (g as { name: string }).name])
  );

  return rows.map((r) => ({
    ...r,
    group_name: nameByKey.get(r.group_id),
  }));
}

export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId);
  return !error;
}
