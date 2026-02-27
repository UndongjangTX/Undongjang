import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { eventTypeLabel } from "@/lib/i18n";

export type EventCardData = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  eventType: "Lightning" | "Regular" | "Special";
  imageUrl: string;
  location?: string;
  recurrenceLabel?: string | null;
};

function eventTypeTagClass(type: "Lightning" | "Regular" | "Special"): string {
  switch (type) {
    case "Regular":
      return "bg-primary-green";
    case "Lightning":
      return "bg-point-gold text-white";
    case "Special":
      return "bg-point-coral";
    default:
      return "bg-primary-green";
  }
}

/** Shorten location to city or a single place name (first segment before comma), or "Online". */
function locationToCity(location: string | undefined): string {
  if (!location?.trim()) return "";
  const lower = location.trim().toLowerCase();
  if (lower === "online" || lower === "remote") return "Online";
  const first = location.split(",")[0]?.trim();
  return first || location;
}

export function EventCard({
  event,
  className,
  showTypeTag,
}: {
  event: EventCardData;
  className?: string;
  showTypeTag?: boolean;
}) {
  const locationShort = locationToCity(event.location);
  const startTimeOnly = event.startTime.replace(/\s+to\s+.+$/i, "").trim();
  const dateTimeLocation = [startTimeOnly, locationShort].filter(Boolean).join(" · ");
  return (
    <Link href={`/events/${event.id}`} className={cn("block shrink-0 w-[240px]", className)}>
      <div className="rounded-xl overflow-hidden bg-[#f5f5f5] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-md flex flex-col relative">
        {/* Outer wrapper: no overflow so pill can extend into text area and sit on top (z-10) */}
        <div className="relative aspect-[1.5/1] w-full shrink-0 z-10">
          <div className="absolute inset-0 overflow-hidden rounded-t-xl bg-muted">
            <Image
              src={event.imageUrl}
              alt=""
            width={240}
            height={160}
              className="object-cover w-full h-full rounded-t-xl"
            />
          </div>
          {/* Pill on top layer; ~15% into text box so detail text needs no indent */}
          {showTypeTag && (
            <span
              className={cn(
                "absolute -left-px bottom-0 z-20 translate-y-[15%] rounded-l-none rounded-r-full pl-4 pr-2.5 py-1 text-xs font-medium text-white",
                eventTypeTagClass(event.eventType)
              )}
            >
              {eventTypeLabel(event.eventType)}
            </span>
          )}
        </div>
        <div className="p-3 flex flex-col min-h-0 relative z-0">
          <p className="text-xs text-muted-foreground line-clamp-1">
            {dateTimeLocation}
          </p>
          <h3 className="font-bold text-primary-green text-sm mt-1 line-clamp-2">
            {event.title}
          </h3>
          {event.recurrenceLabel && (
            <span className="text-xs text-muted-foreground mt-1">{event.recurrenceLabel}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
