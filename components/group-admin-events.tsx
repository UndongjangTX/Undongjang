"use client";

import * as React from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type EventRow = {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  event_type: string;
};

export function GroupAdminEvents({
  groupId,
}: {
  groupId: string;
  groupName: string;
}) {
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = createClient();
    supabase
      .from("events")
      .select("id, title, start_time, end_time, event_type")
      .eq("host_group_id", groupId)
      .order("start_time", { ascending: false })
      .then(({ data }) => {
        setEvents((data ?? []) as EventRow[]);
        setLoading(false);
      });
  }, [groupId]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Events</h2>
        <Button variant="green" asChild>
          <Link href={`/groups/${groupId}/events/new`}>{t("admin.createEvent")}</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t("admin.loadingEvents")}</p>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground">{t("admin.noEventsCreateFirst")}</p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"
            >
              <div>
                <p className="font-medium">{e.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(e.start_time)}
                  {e.end_time ? ` – ${new Date(e.end_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}
                  {" · "}
                  {e.event_type}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/events/${e.id}/admin`}>Edit</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/events/${e.id}`}>View</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
