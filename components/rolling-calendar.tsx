"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getThemeEmoji } from "@/lib/theme-emoji";

type CalendarEventType = "Lightning" | "Regular" | "Special";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  eventType: CalendarEventType;
  isRecurring: boolean;
  categoryName?: string | null;
};

const DAYS_IN_WINDOW = 35; // 5 weeks
const CARD_HEIGHT_PX = 108; // 72 * 1.5

type Props = {
  events: CalendarEvent[];
  startDate: Date;
  onStartDateChange: (next: Date) => void;
  /** Categories from DB; used for exact-name emoji lookup. */
  categories?: { name: string; emoji?: string | null }[];
};

const EVENT_TYPE_PRIORITY: Record<CalendarEventType, number> = {
  Special: 0,
  Lightning: 1,
  Regular: 2,
};

function getMonthKey(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

/** Month key (YYYY-MM) that has the most days in the range; used for title and for greying out other months. */
function getDominantMonthKey(start: Date, end: Date): string | null {
  const daysByMonth: Record<string, number> = {};
  const d = new Date(start);
  while (d <= end) {
    const key = getMonthKey(d);
    daysByMonth[key] = (daysByMonth[key] ?? 0) + 1;
    d.setDate(d.getDate() + 1);
  }
  const entries = Object.entries(daysByMonth);
  const dominant = entries.find(([, count]) => count >= 21);
  return dominant ? dominant[0] : null;
}

/** If at least 3 weeks of the range are in one month, return full month name; else "Feb - Mar". */
function formatMonthTitle(start: Date, end: Date) {
  const dominantKey = getDominantMonthKey(start, end);
  if (dominantKey) {
    const [y, m] = dominantKey.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("default", { month: "long" });
  }
  const startMonth = start.toLocaleString("default", { month: "short" });
  const endMonth = end.toLocaleString("default", { month: "short" });
  if (startMonth === endMonth) return startMonth;
  return `${startMonth} - ${endMonth}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateString(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** Sunday of the week that contains the given date (same day if already Sunday). */
function getSundayBeforeOrOn(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

/** Build 6 options: This month, Next month, then next 4 months. startDate = Sunday that starts the week containing the 1st. */
function getDateWindowOptions(): { value: string; label: string; startDate: Date }[] {
  const today = new Date();
  const options: { value: string; label: string; startDate: Date }[] = [];
  const thisMonthFirst = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthFirst = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  options.push({ value: "this-month", label: "This month", startDate: getSundayBeforeOrOn(thisMonthFirst) });
  options.push({ value: "next-month", label: "Next month", startDate: getSundayBeforeOrOn(nextMonthFirst) });
  for (let i = 2; i <= 5; i++) {
    const first = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const label = first.toLocaleString("default", { month: "long" });
    options.push({ value: getMonthKey(first), label, startDate: getSundayBeforeOrOn(first) });
  }
  return options;
}

export function RollingCalendar({ events, startDate, onStartDateChange, categories = [] }: Props) {
  const router = useRouter();
  const today = new Date();

  const days: Date[] = [];
  for (let i = 0; i < DAYS_IN_WINDOW; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d);
  }
  const endDate = days[days.length - 1];
  const monthTitle = formatMonthTitle(days[0], endDate);
  const dominantMonthKey = getDominantMonthKey(days[0], endDate);
  const dateWindowOptions = getDateWindowOptions();
  const maxStartDate = dateWindowOptions[dateWindowOptions.length - 1]?.startDate;
  const canGoNext = maxStartDate ? startDate.getTime() < maxStartDate.getTime() : true;

  const handlePrev = () => {
    const next = new Date(startDate);
    next.setDate(next.getDate() - DAYS_IN_WINDOW);
    onStartDateChange(next);
  };

  const handleNext = () => {
    if (!canGoNext) return;
    const next = new Date(startDate);
    next.setDate(next.getDate() + DAYS_IN_WINDOW);
    onStartDateChange(next);
  };

  const handleDateWindowSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const opt = dateWindowOptions.find((o) => o.value === value);
    if (opt) onStartDateChange(new Date(opt.startDate));
  };

  const currentOptionValue = (() => {
    const match = dateWindowOptions.find((o) => o.startDate.getTime() === startDate.getTime());
    return match?.value ?? getMonthKey(startDate);
  })();

  return (
    <div className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold md:text-xl text-primary-green">
          {monthTitle}
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={currentOptionValue}
            onChange={handleDateWindowSelect}
            className="h-9 min-w-[8rem] appearance-none rounded-full border border-input bg-background pl-4 pr-10 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-ms-expand]:hidden"
            aria-label="Date range"
          >
            {dateWindowOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="flex items-center rounded-full border border-input bg-background">
            <button
              type="button"
              onClick={handlePrev}
              className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Previous 28 days"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext}
              className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Next 28 days"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-h-[calc(5*var(--day-card-height,132px)+3rem)] overflow-y-auto">
        <div
          className="grid grid-cols-7 gap-2 text-xs md:text-sm"
          style={{ ["--day-card-height" as string]: `${CARD_HEIGHT_PX}px` }}
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
            <div key={label} className="px-1 pb-1 text-center text-muted-foreground">
              {label}
            </div>
          ))}
          {days.map((day) => {
            const eventsForDay = events
              .filter((event) => {
                if (event.isRecurring) return false;
                const [y, m, d] = event.date.split("-").map(Number);
                const eventDate = new Date(y, m - 1, d);
                return sameDay(eventDate, day);
              })
              .sort((a, b) => EVENT_TYPE_PRIORITY[a.eventType] - EVENT_TYPE_PRIORITY[b.eventType])
              .slice(0, 3);

            const isToday = sameDay(day, today);
            const dateStr = toDateString(day);
            const isOutOfMonth = dominantMonthKey !== null && getMonthKey(day) !== dominantMonthKey;

            return (
              <div
                key={day.toISOString()}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/events?date=${dateStr}&view=cards`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/events?date=${dateStr}&view=cards`);
                  }
                }}
                className="min-h-[108px] cursor-pointer rounded-lg border bg-background p-1.5 transition-colors hover:bg-muted/50"
              >
                <div className="mb-1 flex items-center justify-between text-[11px] md:text-xs">
                  <span
                    className={
                      isToday
                        ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-green text-[11px] font-semibold text-white"
                        : isOutOfMonth
                          ? "text-muted-foreground/50"
                          : "text-muted-foreground"
                    }
                  >
                    {day.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {eventsForDay.map((event) => {
                    let pillClass = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium w-full min-w-0";
                    if (event.eventType === "Special") {
                      pillClass += " bg-special-gold text-black";
                    } else if (event.eventType === "Lightning") {
                      pillClass += " bg-lightning-red text-white";
                    } else {
                      pillClass += " bg-secondary text-secondary-foreground";
                    }
                    const emoji = getThemeEmoji(event.categoryName, categories);
                    return (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        className={pillClass + " hover:opacity-90 line-clamp-1 overflow-hidden text-ellipsis"}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="shrink-0" aria-hidden>{emoji}</span>
                        <span className="min-w-0 truncate">{event.title}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
