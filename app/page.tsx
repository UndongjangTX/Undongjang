"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { EventCard, type EventCardData } from "@/components/event-card";
import { GroupCard, type GroupCardData } from "@/components/group-card";
import { Button } from "@/components/ui/button";
import { getPopularGroups, type GroupListItem } from "@/lib/groups";
import { getPopularEvents, popularEventToCardData } from "@/lib/events";
import { getCurrentUserProfile } from "@/lib/user-profile";
import {
  getRecommendedForUser,
  recommendedEventToCardData,
  type RecommendedItem,
} from "@/lib/recommendations";
import {
  getRecentlyAdded,
  recentlyAddedEventToCardData,
  type RecentlyAddedItem,
} from "@/lib/recently-added";
import { t } from "@/lib/i18n";

function groupToListToCard(g: GroupListItem): GroupCardData {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    imageUrl: g.imageUrl,
    locationCity: g.locationCity,
    memberCount: g.memberCount,
    isPrivate: g.isPrivate,
  };
}

export default function Home() {
  const [popularEvents, setPopularEvents] = React.useState<EventCardData[]>([]);
  const [popularGroups, setPopularGroups] = React.useState<GroupCardData[]>([]);
  const [recommended, setRecommended] = React.useState<RecommendedItem[]>([]);
  const [recentlyAdded, setRecentlyAdded] = React.useState<RecentlyAddedItem[]>([]);
  const [loadingPopular, setLoadingPopular] = React.useState(true);
  const [loadingRecommended, setLoadingRecommended] = React.useState(true);
  const [loadingRecentlyAdded, setLoadingRecentlyAdded] = React.useState(true);
  const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof getCurrentUserProfile>>>(null);

  React.useEffect(() => {
    Promise.all([getPopularEvents(8), getPopularGroups(8)]).then(([events, groups]) => {
      setPopularEvents(events.map(popularEventToCardData));
      setPopularGroups(groups.map(groupToListToCard));
      setLoadingPopular(false);
    });
  }, []);

  React.useEffect(() => {
    getCurrentUserProfile().then((p) => {
      setProfile(p);
      getRecommendedForUser(p, 12).then(setRecommended);
      setLoadingRecommended(false);
    });
  }, []);

  React.useEffect(() => {
    getRecentlyAdded(12).then(setRecentlyAdded).finally(() => setLoadingRecentlyAdded(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero — 1x image (1920×677); optimizer off for this image only (sharpness); clip 2px top/bottom for grey line */}
      <section className="hero-banner-section relative mt-3 w-full max-w-full overflow-hidden bg-white">
        <div className="hero-banner-image-wrap overflow-hidden">
          <Image
            src="/hero-banner.png"
            alt=""
            width={1920}
            height={677}
            className="w-full h-auto max-w-full block object-cover"
            priority
            sizes="100vw"
            unoptimized
          />
        </div>
        <div className="absolute inset-0 flex items-center">
          <div className="container relative z-10 py-8 md:py-10">
            <h1 className="font-heading font-extrabold tracking-tight text-primary-green text-[2.5rem] leading-[1.15] md:text-[3rem] lg:text-[3.2rem] lg:leading-[1.2]">
              {t("home.heroTitle1")}
              <br />
              {t("home.heroTitle2")}
            </h1>
            <p className="mt-[30px] text-base leading-[1.5] text-[#4A4A4A] md:text-[1rem] whitespace-pre-line">
              {t("home.heroSub")}
            </p>
            <div className="mt-[32px] flex flex-wrap gap-5">
              <Button asChild size="lg" variant="green" className="min-w-[150px] rounded-full px-6 py-2.5 text-sm">
                <Link href="/events">{t("home.browseEvents")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline-green" className="min-w-[120px] rounded-full px-5 py-2.5 text-sm border-2">
                <Link href="/groups">{t("home.findGroups")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Recommended for you */}
      <section className="container py-8 md:py-10">
        <div className="rounded-2xl bg-primary-green p-6 md:p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="font-heading text-xl font-bold text-white uppercase tracking-tight md:text-2xl">
              {profile?.full_name?.trim()
                ? t("home.recommendedTitle").replace("{{name}}", profile.full_name.trim().split(/\s+/)[0] ?? "")
                : t("home.recommendedTitleGuest")}
            </h2>
          </div>
          {loadingRecommended ? (
            <p className="text-white/90 py-8">{t("home.loadingRecommendations")}</p>
          ) : recommended.filter((item) => item.type === "event").length === 0 ? (
            <p className="text-white/90 py-8">{t("home.recommendedEmpty")}</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
              {recommended
                .filter((item) => item.type === "event")
                .map((item) => (
                  <EventCard
                    key={`evt-${item.event.id}`}
                    event={recommendedEventToCardData(item.event)}
                    showTypeTag
                  />
                ))}
            </div>
          )}
        </div>
      </section>

      {/* Popular Events */}
      <section className="container py-8 md:py-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="font-heading text-xl font-bold text-primary-green uppercase tracking-tight md:text-2xl">
            {t("home.popularEvents")}
          </h2>
          <Link
            href="/events"
            className="text-sm font-medium text-point-coral hover:underline"
          >
            {t("common.seeAll")}
          </Link>
        </div>
        {loadingPopular ? (
          <p className="text-muted-foreground py-8">{t("common.loadingEvents")}</p>
        ) : popularEvents.length === 0 ? (
          <p className="text-muted-foreground py-8">{t("home.noUpcoming")}</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4">
            {popularEvents.map((event) => (
              <EventCard key={event.id} event={event} showTypeTag />
            ))}
          </div>
        )}
      </section>

      {/* Popular Groups */}
      <section className="container py-8 md:py-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="font-heading text-xl font-bold text-primary-green uppercase tracking-tight md:text-2xl">
            {t("home.popularGroups")}
          </h2>
          <Link
            href="/groups"
            className="text-sm font-medium text-point-coral hover:underline"
          >
            {t("common.seeAll")}
          </Link>
        </div>
        {loadingPopular ? (
          <p className="text-muted-foreground py-8">{t("common.loadingGroup")}</p>
        ) : popularGroups.length === 0 ? (
          <p className="text-muted-foreground py-8">{t("home.noGroups")}</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4">
            {popularGroups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}
      </section>

      {/* Recently Added */}
      <section className="container py-8 md:py-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="font-heading text-xl font-bold text-primary-green uppercase tracking-tight md:text-2xl">
            {t("home.recentlyAdded")}
          </h2>
        </div>
        {loadingRecentlyAdded ? (
          <p className="text-muted-foreground py-8">{t("common.loading")}</p>
        ) : recentlyAdded.filter((item) => item.type === "event").length === 0 ? (
          <p className="text-muted-foreground py-8">{t("home.noRecentEvents")}</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4">
            {recentlyAdded
              .filter((item) => item.type === "event")
              .map((item) => (
                <EventCard
                  key={`evt-${item.event.id}`}
                  event={recentlyAddedEventToCardData(item.event)}
                  showTypeTag
                />
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
