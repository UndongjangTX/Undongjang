import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, MapPin } from "lucide-react";
import { EventRsvpButton } from "@/components/event-rsvp-button";
import { EventManageLink } from "@/components/event-manage-link";
import { MessageOrganizerButton } from "@/components/message-organizer-button";
import { PhotoAlbumSection } from "@/components/image-gallery";
import { ProfileListSection } from "@/components/profile-list-section";
import { EventMap } from "@/components/event-map";
import { getEventById } from "@/lib/events";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  return (
    <main className="min-h-screen">
      {/* Full-width banner — 1.5x taller */}
      <section className="relative h-72 w-full md:h-[22.5rem] bg-muted">
        <Image
          src={event.bannerImageUrl}
          alt=""
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
      </section>

      {event.cancelled_at && (
        <div className="bg-destructive/15 text-destructive border-b border-destructive/30 py-3 px-4 text-center font-medium">
          {t("events.cancelled")}
        </div>
      )}

      {/* Header: event name (left) + RSVP (right) */}
      <section className="border-b bg-card">
        <div className="container flex flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:py-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {event.themeDisplayName}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl text-primary-green">
              {event.title}
            </h1>
          </div>
          <div className="shrink-0 md:ml-4 flex flex-wrap items-center gap-3">
            <EventManageLink eventId={event.id} />
            <EventRsvpButton
              eventId={event.id}
              isRecurring={event.isRecurring}
              nextOccurrences={event.nextOccurrences}
            />
          </div>
        </div>
      </section>

      {/* Two-column content: left ~70%, right ~30% — same gap as group detail */}
      <section className="container px-4 py-8 md:py-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_30%] lg:gap-16">
          {/* Left: Date & time, Location, Event detail, Map */}
          <div className="space-y-10">
            {/* Time & Date */}
            <section>
              <h2 className="font-heading text-lg font-semibold md:text-xl">{t("events.timeAndDate")}</h2>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>
                  {event.startTime}
                  {event.endTime ? ` to ${event.endTime}` : ` (${t("events.endTimeTbd")})`}
                  {event.timezone && ` ${event.timezone}`}
                </span>
              </div>
              {event.isRecurring && event.nextOccurrences && event.nextOccurrences.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-foreground">{t("events.nextOccurrencesTitle")}</h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {event.nextOccurrences.map((occ) => (
                      <li key={occ.startTime}>{occ.label}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Location */}
            {(event.locationName || event.address || (event.meeting_url && (event.privacy === "exclusive" || event.hasRsvped))) && (
              <section>
                <h2 className="font-heading text-lg font-semibold md:text-xl">{t("events.location")}</h2>
                <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {(event.locationName || event.address) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        {event.locationName}
                        {event.address && (
                          <>
                            {event.locationName && <br />}
                            <span className="text-foreground/80">
                              {event.address}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  )}
                  {event.meeting_url && (event.privacy === "exclusive" || event.hasRsvped) && (
                    <div>
                      <a
                        href={event.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-green underline hover:no-underline"
                      >
                        {t("events.meetingLink")}
                      </a>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Event Details */}
            <section>
              <h2 className="font-heading text-lg font-semibold md:text-xl">{t("events.eventDetails")}</h2>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {event.description}
              </div>
            </section>

            {/* Map — only for physical address (not online-only) */}
            {event.address &&
              event.address.trim().toLowerCase() !== "온라인" &&
              (
                <section>
                  <EventMap
                    address={event.address}
                    locationName={event.locationName}
                  />
                </section>
              )}
          </div>

          {/* Right: Host, Hosting group, Attendees */}
          <div className="space-y-8">
            {/* Host */}
            <section>
              <h2 className="font-heading text-lg font-semibold md:text-xl">{t("events.host")}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex -space-x-2">
                  {event.hostAvatarUrls.map((src, i) => (
                    <div
                      key={i}
                      className="h-10 w-10 overflow-hidden rounded-full border-2 border-background shadow-sm"
                    >
                      <Image
                        src={src}
                        alt=""
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {event.hostNames.join(", ")}
                </p>
                <MessageOrganizerButton eventId={event.id} />
              </div>
            </section>

            {/* Hosting group */}
            {event.hostGroupId && (
              <section>
                <h2 className="font-heading text-lg font-semibold md:text-xl">
                  {t("events.hostingGroup")}
                </h2>
                <Link
                  href={`/groups/${event.hostGroupId}`}
                  className="mt-3 flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="h-12 w-12 overflow-hidden rounded-lg shrink-0">
                    <Image
                      src={event.hostGroupImageUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="font-medium text-foreground">
                    {event.hostGroupName}
                  </span>
                </Link>
              </section>
            )}

            {/* Attendees — synced from event_attendees + hosts */}
            <ProfileListSection
              title={t("events.attendees")}
              count={event.attendeeCount}
              profiles={event.attendeeProfiles}
              countLabel={t("events.going")}
            />
          </div>
        </div>
      </section>

      {/* Photo album */}
      {event.photoUrls.length > 0 && (
        <div className="container px-4 pb-10 md:pb-14">
          <PhotoAlbumSection urls={event.photoUrls} title={t("events.photoAlbum")} />
        </div>
      )}
    </main>
  );
}
