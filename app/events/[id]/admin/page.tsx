"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getEventById, getEventForEdit, canManageEvent } from "@/lib/events";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { EventAdminDetails } from "@/components/event-admin-details";
import { EventAdminAttendees } from "@/components/event-admin-attendees";
import { EventAdminPhotos } from "@/components/event-admin-photos";
import { EventAdminMessages } from "@/components/event-admin-messages";
import { t } from "@/lib/i18n";

type TabId = "details" | "attendees" | "photos" | "messages";

export default function EventAdminPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [eventTitle, setEventTitle] = React.useState<string | null>(null);
  const [eventForEdit, setEventForEdit] = React.useState<Awaited<ReturnType<typeof getEventForEdit>>>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [unauthorized, setUnauthorized] = React.useState(false);
  const tabFromUrl = searchParams.get("tab");
  const [tab, setTab] = React.useState<TabId>(() => {
    if (tabFromUrl === "attendees" || tabFromUrl === "photos" || tabFromUrl === "messages") return tabFromUrl;
    return "details";
  });

  React.useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "attendees" || t === "photos" || t === "messages") setTab(t);
    else setTab("details");
  }, [searchParams]);

  React.useEffect(() => {
    (async () => {
      const [eventData, eventEdit, profile] = await Promise.all([
        getEventById(params.id),
        getEventForEdit(params.id),
        getCurrentUserProfile(),
      ]);
      if (!eventData || !eventEdit) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!profile?.id || !(await canManageEvent(params.id, profile.id))) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }
      setEventTitle(eventData.title);
      setEventForEdit(eventEdit);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("siteAdmin.loading")}</p>
      </main>
    );
  }
  if (notFound || !eventForEdit) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-muted-foreground">{t("eventAdminPage.eventNotFound")}</p>
        <Button asChild variant="outline">
          <Link href="/events">{t("eventAdminPage.backToEvents")}</Link>
        </Button>
      </main>
    );
  }
  if (unauthorized) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-muted-foreground">{t("eventAdminPage.onlyHostCanManage")}</p>
        <Button asChild variant="outline">
          <Link href={`/events/${params.id}`}>{t("eventAdminPage.backToEvent")}</Link>
        </Button>
      </main>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "details", label: t("eventAdminPage.details") },
    { id: "attendees", label: t("eventAdminPage.attendees") },
    { id: "photos", label: t("eventAdminPage.photos") },
    { id: "messages", label: t("eventAdminPage.messages") },
  ];

  return (
    <main className="min-h-screen border-b">
      <div className="container px-4 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("eventAdminPage.manageEvent")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{eventTitle ?? t("events.title")}</h1>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/events/${params.id}`}>{t("eventAdminPage.viewEventPage")}</Link>
          </Button>
        </div>

        <nav className="mt-6 flex gap-1 border-b">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                router.replace(`/events/${params.id}/admin?tab=${id}`, { scroll: false });
              }}
              className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? "border border-b-0 border-b-background bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="py-6">
          {tab === "details" && (
            <EventAdminDetails
              event={eventForEdit}
              onCancelled={() => getEventForEdit(params.id).then((data) => data && setEventForEdit(data))}
            />
          )}
          {tab === "attendees" && (
            <EventAdminAttendees
              eventId={params.id}
              hostGroupId={eventForEdit.host_group_id}
            />
          )}
          {tab === "photos" && <EventAdminPhotos eventId={params.id} />}
          {tab === "messages" && <EventAdminMessages eventId={params.id} />}
        </div>
      </div>
    </main>
  );
}
