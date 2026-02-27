"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { EventCard, type EventCardData } from "@/components/event-card";
import { Button } from "@/components/ui/button";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { useOnboarding } from "@/context/onboarding-context";
import { getGroupById, type GroupDetailData } from "@/lib/groups";
import { isMember, requestToJoin, joinGroup } from "@/lib/group-admin";
import { PhotoAlbumSection } from "@/components/image-gallery";
import { ProfileListSection } from "@/components/profile-list-section";
import { MessageOrganizerButton } from "@/components/message-organizer-button";
import { t } from "@/lib/i18n";

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop";

function toEventCardData(e: GroupDetailData["upcomingEvents"][0]): EventCardData {
  return {
    id: e.id,
    title: e.title,
    startTime: e.startTime,
    endTime: e.endTime,
    eventType: e.eventType,
    imageUrl: e.imageUrl,
    location: e.location ?? undefined,
    recurrenceLabel: e.recurrenceLabel ?? undefined,
  };
}

export default function GroupDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { openModal } = useOnboarding();
  const [group, setGroup] = React.useState<GroupDetailData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [isJoining, setIsJoining] = React.useState(false);
  const [canManage, setCanManage] = React.useState(false);
  const [isMemberState, setIsMemberState] = React.useState(false);
  const [requestSent, setRequestSent] = React.useState(false);

  React.useEffect(() => {
    getGroupById(params.id).then((data) => {
      if (data) {
        if (data.deleted_at) setNotFound(true);
        else setGroup(data);
      } else setNotFound(true);
      setLoading(false);
    });
  }, [params.id]);

  React.useEffect(() => {
    if (!group || !group.organizerId) {
      setCanManage(false);
      return;
    }
    getCurrentUserProfile().then(async (profile) => {
      if (!profile?.id) {
        setCanManage(false);
        return;
      }
      const { canManageGroup } = await import("@/lib/groups");
      setCanManage(await canManageGroup(group.id, profile.id));
    });
  }, [group]);

  React.useEffect(() => {
    if (!group) return;
    getCurrentUserProfile().then(async (profile) => {
      if (!profile?.id) {
        setIsMemberState(false);
        return;
      }
      setIsMemberState(await isMember(group.id, profile.id));
    });
  }, [group]);

  async function handleJoinGroup() {
    if (!group) return;
    const profile = await getCurrentUserProfile();
    if (!profile?.id) return;
    const hasPhoneNumber = !!profile?.phone_number?.trim();

    if (!hasPhoneNumber) {
      openModal({
        source: "join_group",
        onComplete: () => {
          if (group.isPrivate) {
            requestToJoin(group.id, profile.id).then((r) => {
              if (r.ok) setIsMemberState(false);
            });
          } else {
            joinGroup(group.id, profile.id).then((r) => {
              if (r.ok) {
                setIsMemberState(true);
                getGroupById(group.id).then((data) => data && setGroup(data));
              }
            });
          }
        },
      });
      return;
    }

    setIsJoining(true);
    try {
      if (group.isPrivate) {
        const result = await requestToJoin(group.id, profile.id);
        if (result.ok) setRequestSent(true);
      } else {
        const result = await joinGroup(group.id, profile.id);
        if (result.ok) {
          setIsMemberState(true);
          const data = await getGroupById(group.id);
          if (data) setGroup(data);
        }
      }
    } finally {
      setIsJoining(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("common.loadingGroup")}</p>
      </main>
    );
  }

  if (notFound || !group) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-muted-foreground">{t("groups.groupNotFound")}</p>
        <Button asChild variant="outline">
          <Link href="/groups">{t("groups.backToGroups")}</Link>
        </Button>
      </main>
    );
  }

  const photoUrls =
    group.photoUrls.length > 0
      ? group.photoUrls
      : [group.coverImageUrl];

  return (
    <main className="min-h-screen">
      <section className="bg-card border-b">
        <div className="relative h-48 w-full md:h-60">
          <Image
            src={group.coverImageUrl}
            alt=""
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="container px-4 py-6 md:py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.categoryDisplayName ?? ""}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl text-primary-green">
                {group.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {group.locationCity ?? t("common.noLocation")} · {group.memberCount.toLocaleString()}{" "}
                {t("groups.memberCount")}
              </p>
            </div>
            {canManage ? (
              <Button size="lg" variant="green" asChild>
                <Link href={`/groups/${group.id}/admin`}>{t("groups.manageGroup")}</Link>
              </Button>
            ) : isMemberState ? (
              <Button size="lg" variant="outline" disabled>
                {t("groups.youAreMember")}
              </Button>
            ) : requestSent && group.isPrivate ? (
              <Button size="lg" variant="outline" disabled>
                {t("groups.requestSent")}
              </Button>
            ) : (
              <Button
                size="lg"
                variant="green"
                onClick={handleJoinGroup}
                disabled={isJoining}
              >
                {isJoining
                  ? t("misc.checkingProfile")
                  : group.isPrivate
                    ? t("groups.requestToJoin")
                    : t("groups.joinGroup")}
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="container px-4 py-8 md:py-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_30%] lg:gap-16">
          <div className="space-y-10">
            <section>
              <h2 className="font-heading text-lg font-semibold md:text-xl">{t("groups.about")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {group.description || t("common.noDescription")}
              </p>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-heading text-lg font-semibold md:text-xl">
                  {t("groups.upcomingEvents")}
                </h2>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/groups/${group.id}/events`}>{t("groups.seeAllEvents")}</Link>
                  </Button>
                </div>
              </div>
              {group.upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("groups.noUpcomingEvents")}</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {group.upcomingEvents.slice(0, 4).map((event) => (
                    <EventCard
                      key={event.id}
                      event={toEventCardData(event)}
                      className="w-full"
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-heading text-lg font-semibold md:text-xl">{t("groups.photos")}</h2>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/groups/${group.id}/photos`}>{t("groups.seeAllPhotos")}</Link>
                </Button>
              </div>
              <PhotoAlbumSection urls={photoUrls} maxGrid={8} />
            </section>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="sr-only">Group organizer</h2>
              <div className="flex items-center gap-2 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                <Link
                  href={group.organizerId ? `/profile` : "#"}
                  className="flex min-w-0 flex-1 flex-col items-center sm:flex-row sm:items-center sm:gap-4 sm:text-left"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-background">
                    <Image
                      src={group.organizerId ? (group.memberProfiles.find((p) => p.user_id === group.organizerId)?.avatar_url || DEFAULT_AVATAR) : DEFAULT_AVATAR}
                      alt=""
                      width={56}
                      height={56}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="mt-3 min-w-0 sm:mt-0">
                    <p className="font-semibold text-foreground">
                      {group.organizerName || t("groups.organizer")}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("groups.organizer")}</p>
                  </div>
                </Link>
                <MessageOrganizerButton groupId={group.id} iconOnly />
              </div>
            </section>

            <ProfileListSection
              title={t("groups.members")}
              count={group.memberCount}
              profiles={group.memberProfiles}
              countLabel={t("groups.memberCount")}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
