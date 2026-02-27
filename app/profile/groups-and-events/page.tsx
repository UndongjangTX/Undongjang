"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getMyGroups } from "@/lib/groups";
import { getMyEvents } from "@/lib/events";
import { restoreGroup } from "@/lib/group-admin";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getUnreadCounts, type UnreadCounts } from "@/lib/messenger";
import { t } from "@/lib/i18n";

const DEFAULT_COVER = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=400&fit=crop";
const DEFAULT_EVENT = "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=560&h=238&fit=crop";

export default function MyGroupsAndEventsPage() {
  const router = useRouter();
  const [groups, setGroups] = React.useState<Awaited<ReturnType<typeof getMyGroups>>>([]);
  const [events, setEvents] = React.useState<Awaited<ReturnType<typeof getMyEvents>>>([]);
  const [unread, setUnread] = React.useState<UnreadCounts | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  React.useEffect(() => {
    getCurrentUserProfile().then(async (profile) => {
      if (!profile?.id) {
        router.replace("/login");
        return;
      }
      const [g, e, u] = await Promise.all([
        getMyGroups(profile.id),
        getMyEvents(profile.id),
        getUnreadCounts(profile.id),
      ]);
      setGroups(g);
      setEvents(e);
      setUnread(u);
      setLoading(false);
    });
  }, [router]);

  async function handleRestore(groupId: string) {
    const profile = await getCurrentUserProfile();
    if (!profile?.id) return;
    setRestoringId(groupId);
    const result = await restoreGroup(groupId, profile.id);
    setRestoringId(null);
    if (result.ok) {
      const [g] = await Promise.all([getMyGroups(profile.id)]);
      setGroups(g);
    } else {
      alert(result.error);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="container max-w-4xl space-y-12">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-primary-green">{t("groups.myGroupsAndEvents")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("groups.myGroupsAndEventsSub")}
          </p>
        </div>

        <section id="groups">
          <h2 className="font-heading text-lg font-semibold mb-4 text-primary-green">{t("nav.myGroups")}</h2>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("groups.notInAnyGroups")}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {groups.map((g) => (
                <li key={g.id} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                  <div className="flex gap-4 p-4">
                    <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={g.cover_image_url || DEFAULT_COVER}
                        alt=""
                        width={128}
                        height={80}
                        className="h-full w-full object-cover"
                      />
                      {(unread?.byGroup[g.id] ?? 0) > 0 && (
                        <span className="absolute top-1 right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-destructive-foreground">
                          {(unread?.byGroup[g.id] ?? 0) > 99 ? "99+" : (unread?.byGroup[g.id] ?? 0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {g.isOwner && (
                          <span className="rounded-full bg-primary-green px-2 py-0.5 text-xs font-medium text-white">
                            {t("groups.owner")}
                          </span>
                        )}
                        {g.deleted_at && (
                          <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 px-2 py-0.5 text-xs font-medium">
                            {t("groups.scheduledForDeletion")}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground mt-1 line-clamp-1">{g.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {g.deleted_at ? (
                          <>
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/groups/${g.id}/admin`}>{t("common.manage")}</Link>
                            </Button>
                            {g.isOwner && (
                              <Button
                                size="sm"
                                variant="green"
                                onClick={() => handleRestore(g.id)}
                                disabled={restoringId === g.id}
                              >
                                {restoringId === g.id ? t("groups.restoring") : t("groups.restoreGroup")}
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/groups/${g.id}`}>{t("groups.viewGroup")}</Link>
                            </Button>
                            {g.isOwner && (
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/groups/${g.id}/admin`}>{t("common.manage")}</Link>
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="events">
          <h2 className="font-heading text-lg font-semibold mb-4 text-primary-green">{t("nav.myEvents")}</h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">You’re not hosting or attending any events.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                  <div className="flex gap-4 p-4">
                    <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={e.banner_image_url || DEFAULT_EVENT}
                        alt=""
                        width={128}
                        height={80}
                        className="h-full w-full object-cover"
                      />
                      {(unread?.byEvent[e.id] ?? 0) > 0 && (
                        <span className="absolute top-1 right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-destructive-foreground">
                          {(unread?.byEvent[e.id] ?? 0) > 99 ? "99+" : (unread?.byEvent[e.id] ?? 0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {(e.isHost || e.canManage) && (
                        <span className="rounded-full bg-primary-green px-2 py-0.5 text-xs font-medium text-white">
                          {e.canManage ? t("groups.owner") : t("events.host")}
                        </span>
                      )}
                      <h3 className="font-semibold text-foreground mt-1 line-clamp-1">{e.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(e.start_time).toLocaleString()}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/events/${e.id}`}>{t("events.viewEvent")}</Link>
                        </Button>
                        {e.canManage && (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/events/${e.id}/admin`}>{t("common.manage")}</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-sm text-muted-foreground">
          <Link href="/profile" className="font-medium text-point-coral hover:underline">
            {t("groups.backToProfile")}
          </Link>
        </p>
      </div>
    </main>
  );
}
