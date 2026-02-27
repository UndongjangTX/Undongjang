import Link from "next/link";
import { EventCard, type EventCardData } from "@/components/event-card";
import { GroupCard, type GroupCardData } from "@/components/group-card";
import { searchEvents, searchGroups } from "@/lib/search";
import { t } from "@/lib/i18n";

type SearchPageProps = {
  searchParams: {
    q?: string;
  };
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = (searchParams.q ?? "").trim();

  let events: EventCardData[] = [];
  let groups: GroupCardData[] = [];

  if (query) {
    [events, groups] = await Promise.all([
      searchEvents(query),
      searchGroups(query),
    ]);
  }

  return (
    <main className="min-h-screen">
      <section className="container px-4 py-8 md:py-10">
        {!query && (
          <p className="text-sm text-muted-foreground">
            {t("search.useSearchBar")}
          </p>
        )}

        {query && (
          <div className="space-y-10">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-heading text-lg font-semibold md:text-xl text-primary-green">
                  {t("search.eventsMatching")} &quot;{query}&quot;
                </h2>
                <Link
                  href="/events"
                  className="text-sm font-medium text-point-coral hover:underline"
                >
                  {t("search.browseAllEvents")}
                </Link>
              </div>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("search.noEventsFound")}
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {events.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-heading text-lg font-semibold md:text-xl text-primary-green">
                  {t("search.groupsMatching")} &quot;{query}&quot;
                </h2>
                <Link
                  href="/groups"
                  className="text-sm font-medium text-point-coral hover:underline"
                >
                  {t("search.browseAllGroups")}
                </Link>
              </div>
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("search.noGroupsFound")}
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.map((group) => (
                    <GroupCard key={group.id} group={group} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

