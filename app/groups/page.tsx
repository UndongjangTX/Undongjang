"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { GroupCard, type GroupCardData } from "@/components/group-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGroups, type GroupListItem } from "@/lib/groups";
import { getCategories, type Category } from "@/lib/categories";
import { ALL_CATEGORIES_EMOJI } from "@/lib/theme-emoji";
import { getCategoryDisplayName } from "@/lib/category-labels";
import { useOnboarding } from "@/context/onboarding-context";
import { getCurrentUserProfile, hasPhoneNumber } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n";

function toCardData(g: GroupListItem): GroupCardData {
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

export default function GroupsPage() {
  const router = useRouter();
  const { openModal } = useOnboarding();
  const [activeCategory, setActiveCategory] = React.useState<string>("All");
  const [currentBoostedIndex, setCurrentBoostedIndex] = React.useState(0);
  const [groups, setGroups] = React.useState<GroupListItem[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [profile, setProfile] = React.useState<{ interested_categories: string[] } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState<{ id: string } | null>(null);

  React.useEffect(() => {
    createClient().auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));
  }, []);

  React.useEffect(() => {
    Promise.all([getGroups(), getCategories(), getCurrentUserProfile()]).then(([groupsData, categoriesData, p]) => {
      setGroups(groupsData);
      setCategories(categoriesData);
      setProfile(p ?? null);
      setLoading(false);
    });
  }, []);

  const boostedGroups = React.useMemo(
    () => groups.filter((g) => g.is_boosted),
    [groups]
  );
  const groupsByPopularity = React.useMemo(
    () => [...groups].sort((a, b) => b.memberCount - a.memberCount),
    [groups]
  );
  const carouselGroups = boostedGroups.length > 0 ? boostedGroups : groupsByPopularity;
  const filteredGroups = React.useMemo(() => {
    if (activeCategory === "All") return groups;
    return groups.filter((g) => g.categoryName === activeCategory);
  }, [groups, activeCategory]);

  const categoryFilters = React.useMemo(() => {
    const groupCountByCategory: Record<string, number> = {};
    groups.forEach((g) => {
      groupCountByCategory[g.categoryName] = (groupCountByCategory[g.categoryName] ?? 0) + 1;
    });
    const interestedIds = profile?.interested_categories ?? [];
    const interestedNames = interestedIds
      .map((id) => categories.find((c) => c.id === id)?.name)
      .filter((name): name is string => !!name && categories.some((c) => c.name === name));
    const rest = categories
      .filter((c) => !interestedIds.includes(c.id))
      .map((c) => c.name)
      .sort((a, b) => (groupCountByCategory[b] ?? 0) - (groupCountByCategory[a] ?? 0));
    const seen = new Set<string>();
    const ordered = [...interestedNames, ...rest].filter((name) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
    return ["All", ...ordered];
  }, [categories, groups, profile?.interested_categories]);

  const displayBoosted = carouselGroups[currentBoostedIndex] ?? carouselGroups[0];

  function goToPrev() {
    setCurrentBoostedIndex((prev) =>
      prev === 0 ? carouselGroups.length - 1 : prev - 1,
    );
  }

  function goToNext() {
    setCurrentBoostedIndex((prev) =>
      prev === carouselGroups.length - 1 ? 0 : prev + 1,
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("groups.loadingGroups")}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Sticky category sub-menu */}
      <section className="sticky top-14 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex gap-2 overflow-x-auto py-3">
          {categoryFilters.map((category) => {
            const isActive = activeCategory === category;
            const emoji = category === "All" ? ALL_CATEGORIES_EMOJI : (categories.find((c) => c.name === category)?.emoji ?? "📅");
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors md:text-sm flex items-center gap-1.5",
                  isActive
                    ? "bg-primary-green text-white border-primary-green"
                    : "bg-background text-foreground hover:bg-muted",
                )}
              >
                <span aria-hidden>{emoji}</span>
                {category === "All" ? t("home.allCategories") : getCategoryDisplayName(category, categories.find((c) => c.name === category)?.name_ko ?? undefined)}
              </button>
            );
          })}
        </div>
      </section>

      {/* Boosted groups carousel */}
      {carouselGroups.length > 0 && (
        <section className="container py-6 md:py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl text-primary-green">
                {t("groups.groupsTitle")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
                {t("groups.highlightedForYou")}
              </p>
            </div>
            <Button
              variant="green"
              size="default"
              className="shrink-0"
              onClick={async () => {
                if (!user) {
                  router.push("/login");
                  return;
                }
                const profile = await getCurrentUserProfile();
                if (!hasPhoneNumber(profile)) {
                  openModal({
                    source: "start_group",
                    onComplete: () => router.push("/groups/new"),
                  });
                  return;
                }
                router.push("/groups/new");
              }}
            >
              {t("groups.startGroup")}
            </Button>
          </div>

          <div className="mt-4 rounded-2xl bg-muted/70 p-4 md:p-6">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {boostedGroups.length > 0 ? t("groups.boostedGroups") : t("groups.featured")}
              </h2>
              {carouselGroups.length > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t("groups.prevBoosted")}
                    onClick={goToPrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t("groups.nextBoosted")}
                    onClick={goToNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <Link
              href={`/groups/${displayBoosted.id}`}
              className="flex flex-col sm:flex-row gap-4 md:gap-6"
            >
              <div className="w-full sm:w-[45%] shrink-0 aspect-[1.5/1] relative overflow-hidden rounded-xl bg-muted">
                <Image
                  src={displayBoosted.imageUrl}
                  alt=""
                  fill
                  className="object-cover rounded-xl"
                  sizes="(max-width: 640px) 100vw, 288px"
                />
              </div>
              <div className="flex-1 flex flex-col justify-start min-w-0">
                <p className="text-sm text-muted-foreground">{displayBoosted.categoryDisplayName}</p>
                <h3 className="mt-0.5 text-xl font-bold text-primary-green tracking-tight md:text-2xl">
                  {displayBoosted.name}
                </h3>
                {displayBoosted.locationCity && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 text-primary-green" />
                    {displayBoosted.locationCity}
                  </p>
                )}
                {displayBoosted.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                    {displayBoosted.description}
                  </p>
                )}
              </div>
            </Link>

            {carouselGroups.length > 1 && (
              <div className="mt-4 flex justify-center gap-1.5">
                {carouselGroups.map((group, index) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setCurrentBoostedIndex(index)}
                    aria-label={`${t("groups.groupsTitle")} ${index + 1}`}
                    className={cn(
                      "h-1.5 w-5 rounded-full bg-muted-foreground/20 transition-colors",
                      currentBoostedIndex === index && "bg-primary-green",
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* All groups grid */}
      <section className="container pb-10 md:pb-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="font-heading text-lg font-semibold md:text-xl text-primary-green">
            {carouselGroups.length > 0 ? t("groups.allGroups") : t("groups.groupsTitle")}
          </h2>
          {carouselGroups.length === 0 && (
            <Button
              variant="green"
              size="default"
              className="shrink-0"
              onClick={async () => {
                if (!user) {
                  router.push("/login");
                  return;
                }
                const profile = await getCurrentUserProfile();
                if (!hasPhoneNumber(profile)) {
                  openModal({
                    source: "start_group",
                    onComplete: () => router.push("/groups/new"),
                  });
                  return;
                }
                router.push("/groups/new");
              }}
            >
              {t("groups.startGroup")}
            </Button>
          )}
        </div>

        {filteredGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("groups.noGroupsStartOne")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filteredGroups.map((group) => (
              <GroupCard key={group.id} group={toCardData(group)} className="w-full" />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

