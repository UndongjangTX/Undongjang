"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getUnreadNotifications,
  markNotificationRead,
  type NotificationRow,
  type NotificationType,
} from "@/lib/notifications";

function label(type: NotificationType, groupName?: string): string {
  const name = groupName || "a group";
  switch (type) {
    case "new_member_request":
      return `New member request in ${name}`;
    case "ownership_transfer_request":
      return `You've been asked to accept ownership of ${name}`;
    case "admin_invite":
      return `You've been invited to be an admin of ${name}`;
    default:
      return "New notification";
  }
}

export function NotificationsPopup() {
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<NotificationRow[]>([]);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return;
      getUnreadNotifications(session.user.id).then((list) => {
        setNotifications(list);
      });
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        getUnreadNotifications(session.user.id).then(setNotifications);
        setDismissed(false);
      } else {
        setNotifications([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleView(n: NotificationRow) {
    await markNotificationRead(n.id, n.user_id);
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    router.push(`/groups/${n.group_id}/admin?tab=members`);
  }

  async function handleDismiss(n: NotificationRow) {
    await markNotificationRead(n.id, n.user_id);
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
  }

  if (notifications.length === 0 || dismissed) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2 rounded-lg border bg-card p-3 shadow-lg"
      role="alert"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Notifications</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss all"
        >
          ×
        </button>
      </div>
      <ul className="space-y-2">
        {notifications.slice(0, 5).map((n) => (
          <li
            key={n.id}
            className="flex flex-col gap-1 rounded border bg-background p-2 text-sm"
          >
            <p>{label(n.type, n.group_name)}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleView(n)}
                className="text-primary-green font-medium hover:underline"
              >
                View
              </button>
              <button
                type="button"
                onClick={() => handleDismiss(n)}
                className="text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
      {notifications.length > 5 && (
        <p className="text-xs text-muted-foreground">
          +{notifications.length - 5} more
        </p>
      )}
    </div>
  );
}
