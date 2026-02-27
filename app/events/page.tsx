"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Map, MapPin } from "lucide-react";
import { EventCard, type EventCardData } from "@/components/event-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getEventsList, getCalendarEvents, type EventListItem } from "@/lib/events";
import { getCategories, type Category } from "@/lib/categories";
import { ALL_CATEGORIES_EMOJI } from "@/lib/theme-emoji";
import { RollingCalendar, type CalendarEvent } from "@/components/rolling-calendar";
import { getCategoryDisplayName } from "@/lib/category-labels";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { t } from "@/lib/i18n";

function eventToListCard(e: EventListItem): EventCardData {
  return {
    id: e.id,
    title: e.title,
    startTime: e.startTime,
    endTime: e.endTime,
    eventType: e.eventType,
    imageUrl: e.imageUrl,
    location: e.location,
  };
}

function isEventInDateRange(
  startTimeIso: string,
  range: "today" | "this-week" | "this-month" | string
): boolean {
  const start = new Date(startTimeIso);
  const now = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === "today") {
    return startDay.getTime() === nowDay.getTime();
  }
  if (range === "this-week") {
    const weekEnd = new Date(nowDay);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return startDay >= nowDay && startDay < weekEnd;
  }
  if (range === "this-month") {
    return start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear() && startDay >= nowDay;
  }
  // Specific date YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(range)) {
    const [y, m, d] = range.split("-").map(Number);
    const targetDay = new Date(y, m - 1, d);
    return startDay.getTime() === targetDay.getTime();
  }
  return true;
}

type ViewTab = "cards" | "calendar" | "map";

function EventsPageContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const viewParam = searchParams.get("view") as ViewTab | null;

  const [activeCategory, setActiveCategory] = React.useState<string>("All");
  const [currentBoostedIndex, setCurrentBoostedIndex] = React.useState(0);
  const [dateFilter, setDateFilter] = React.useState<string>(dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : "any");
  const [locationFilter, setLocationFilter] = React.useState<string>("");
  const [events, setEvents] = React.useState<EventListItem[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [profile, setProfile] = React.useState<{ interested_categories: string[] } | null>(null);
  const [calendarEvents, setCalendarEvents] = React.useState<CalendarEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [calendarStartDate, setCalendarStartDate] = React.useState<Date>(() => {
    const t = new Date();
    const first = new Date(t.getFullYear(), t.getMonth(), 1);
    first.setDate(1 - first.getDay());
    return first;
  });

  const [view, setView] = React.useState<ViewTab>(
    () => (viewParam === "calendar" || viewParam === "map" ? viewParam : "cards")
  );

  function setViewAndUrl(next: ViewTab) {
    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(null, "", url.pathname + url.search);
  }

  React.useEffect(() => {
    Promise.all([getEventsList(), getCategories(), getCurrentUserProfile()]).then(([eventsData, categoriesData, p]) => {
      setEvents(eventsData);
      setCategories(categoriesData);
      setProfile(p ?? null);
      setLoading(false);
    });
  }, []);

  const calendarThemeId = React.useMemo(() => {
    if (activeCategory === "All") return null;
    return categories.find((c) => c.name === activeCategory)?.id ?? null;
  }, [activeCategory, categories]);

  React.useEffect(() => {
    if (view !== "calendar") return;
    const start = new Date(calendarStartDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 35);
    getCalendarEvents(start, end, {
      categoryId: calendarThemeId,
      location: locationFilter.trim() || null,
    }).then(setCalendarEvents);
  }, [view, calendarStartDate, calendarThemeId, locationFilter]);

  // Sync date filter from URL when date param is present
  React.useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setDateFilter(dateParam);
    }
  }, [dateParam]);

  const categoryFilters = React.useMemo(() => {
    const eventCountByCategory: Record<string, number> = {};
    events.forEach((e) => {
      eventCountByCategory[e.categoryName] = (eventCountByCategory[e.categoryName] ?? 0) + 1;
    });
    const interestedIds = profile?.interested_categories ?? [];
    const interestedNames = interestedIds
      .map((id) => categories.find((c) => c.id === id)?.name)
      .filter((name): name is string => !!name && categories.some((c) => c.name === name));
    const rest = categories
      .filter((c) => !interestedIds.includes(c.id))
      .map((c) => c.name)
      .sort((a, b) => (eventCountByCategory[b] ?? 0) - (eventCountByCategory[a] ?? 0));
    const seen = new Set<string>();
    const ordered = [...interestedNames, ...rest].filter((name) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
    return ["All", ...ordered];
  }, [categories, events, profile?.interested_categories]);

  const boostedEvents = React.useMemo(() => {
    const boosted = events.filter((e) => e.is_boosted);
    return boosted.length > 0 ? boosted : events.slice(0, 3);
  }, [events]);

  const boostedEvent = boostedEvents[currentBoostedIndex];

  const filteredEvents = React.useMemo(() => {
    return events.filter((event) => {
      if (activeCategory !== "All" && event.categoryName !== activeCategory) return false;
      if (dateFilter !== "any" && !isEventInDateRange(event.start_time, dateFilter)) return false;
      if (locationFilter.trim() && !event.location?.toLowerCase().includes(locationFilter.trim().toLowerCase())) return false;
      return true;
    });
  }, [events, activeCategory, dateFilter, locationFilter]);

  function goToPrev() {
    setCurrentBoostedIndex((prev) =>
      prev === 0 ? boostedEvents.length - 1 : prev - 1,
    );
  }

  function goToNext() {
    setCurrentBoostedIndex((prev) =>
      prev === boostedEvents.length - 1 ? 0 : prev + 1,
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("events.loadingEvents")}</p>
      </main>
    );
  }

  const filterBar = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">{t("events.viewLabel")}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setViewAndUrl("cards")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            view === "cards"
              ? "bg-primary-green text-white"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          {t("events.cards")}
        </button>
        <button
          type="button"
          onClick={() => setViewAndUrl("calendar")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            view === "calendar"
              ? "bg-primary-green text-white"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          <Calendar className="h-4 w-4" />
          {t("events.calendar")}
        </button>
        <button
          type="button"
          onClick={() => setViewAndUrl("map")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            view === "map"
              ? "bg-primary-green text-white"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          <Map className="h-4 w-4" />
          {t("events.map")}
        </button>
      </div>
      <span className="h-4 w-px bg-border" aria-hidden />
      {view !== "calendar" && (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground shrink-0">{t("events.dateLabel")}</span>
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-9 min-w-[8rem] appearance-none rounded-full border border-input bg-background pl-4 pr-10 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-green [&::-ms-expand]:hidden"
              >
                <option value="any">{t("events.anyTime")}</option>
                <option value="today">{t("events.today")}</option>
                <option value="this-week">{t("events.thisWeek")}</option>
                <option value="this-month">{t("events.thisMonth")}</option>
                {dateFilter && /^\d{4}-\d{2}-\d{2}$/.test(dateFilter) && (
                  <option value={dateFilter}>
                    {new Date(dateFilter + "T12:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </option>
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-green" aria-hidden />
            </div>
          </div>
          <span className="h-4 w-px bg-border" aria-hidden />
        </>
      )}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground shrink-0">{t("events.location")}</span>
        <Input
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          placeholder={t("events.locationPlaceholder")}
          className="h-9 w-40 md:w-56"
        />
      </div>
    </div>
  );

  return (
    <main className="min-h-screen">
      {/* Sticky category sub-menu */}
      <section className="sticky top-14 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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

      {/* Boosted / featured events carousel */}
      {boostedEvents.length > 0 && (
        <section className="container py-6 md:py-8">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl text-primary-green">
                {t("events.eventsTitle")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("events.highlightedForYou")}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-muted/70 p-4 md:p-6">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {events.some((e) => e.is_boosted) ? t("events.boostedEvents") : t("events.featured")}
              </h2>
              {boostedEvents.length > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t("events.prevBoosted")}
                    onClick={goToPrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t("events.nextBoosted")}
                    onClick={goToNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <Link
              href={`/events/${boostedEvent.id}`}
              className="flex flex-col sm:flex-row gap-4 md:gap-6"
            >
              <div className="w-full sm:w-[45%] shrink-0 aspect-[1.5/1] relative overflow-hidden rounded-xl bg-muted">
                <Image
                  src={boostedEvent.imageUrl}
                  alt=""
                  fill
                  className="object-cover rounded-xl"
                  sizes="(max-width: 640px) 100vw, 288px"
                />
              </div>
              <div className="flex-1 flex flex-col justify-start min-w-0">
                <p className="text-sm text-muted-foreground">{boostedEvent.categoryDisplayName}</p>
                <h3 className="mt-0.5 text-xl font-bold text-primary-green tracking-tight md:text-2xl">
                  {boostedEvent.title}
                </h3>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0 text-primary-green" />
                  {boostedEvent.startTime}
                </p>
                {boostedEvent.location && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 text-primary-green" />
                    {boostedEvent.location}
                  </p>
                )}
              </div>
            </Link>

            {boostedEvents.length > 1 && (
              <div className="mt-4 flex justify-center gap-1.5">
                {boostedEvents.map((event, index) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setCurrentBoostedIndex(index)}
                    aria-label={`${t("events.goToBoosted")} ${index + 1}`}
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

      {/* Filters + view-dependent content */}
      <section className="container pb-10 md:pb-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
          <h2 className="font-heading text-lg font-semibold md:text-xl text-primary-green">
            {boostedEvents.length > 0 ? t("events.allEvents") : t("events.eventsTitle")}
          </h2>
          {filterBar}
        </div>

        {/* Only this section changes by view */}
        {view === "cards" && (
          <>
            {filteredEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("events.noEventsMatchFilters")}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {filteredEvents.map((event) => (
                  <EventCard key={event.id} event={eventToListCard(event)} className="w-full" />
                ))}
              </div>
            )}
          </>
        )}
        {view === "calendar" && (
          <RollingCalendar
            events={calendarEvents}
            startDate={calendarStartDate}
            onStartDateChange={setCalendarStartDate}
            categories={categories}
          />
        )}
        {view === "map" && (
          <div className="rounded-2xl border bg-muted/30 p-12 text-center">
            <Map className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="font-heading mt-4 text-lg font-semibold text-primary-green">{t("events.mapView")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("events.comingSoon")}</p>
          </div>
        )}
      </section>
    </main>
  );
}

export default function EventsPage() {
  return (
    <React.Suspense fallback={<main className="container py-6"><p className="text-muted-foreground">Loading…</p></main>}>
      <EventsPageContent />
    </React.Suspense>
  );
}
