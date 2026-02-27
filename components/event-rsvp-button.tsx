"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { useOnboarding } from "@/context/onboarding-context";
import { t } from "@/lib/i18n";

type Occurrence = { startTime: string; label: string };

export function EventRsvpButton({
  eventId,
  isRecurring,
  nextOccurrences,
}: {
  eventId: string;
  isRecurring?: boolean;
  nextOccurrences?: Occurrence[];
}) {
  const router = useRouter();
  const { openModal } = useOnboarding();
  const [loading, setLoading] = React.useState(false);
  const [isGoing, setIsGoing] = React.useState(false);
  const [checked, setChecked] = React.useState(false);
  const [pickingDate, setPickingDate] = React.useState(false);

  React.useEffect(() => {
    getCurrentUserProfile().then(async (profile) => {
      if (!profile?.id) {
        setChecked(true);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("event_attendees")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", profile.id)
        .maybeSingle();
      setIsGoing(!!data);
      setChecked(true);
    });
  }, [eventId]);

  async function rsvp(userId: string, occurrenceStartTime?: string) {
    const supabase = createClient();
    const payload: { event_id: string; user_id: string; occurrence_start_time?: string } = {
      event_id: eventId,
      user_id: userId,
    };
    if (occurrenceStartTime) payload.occurrence_start_time = occurrenceStartTime;
    const { error } = await supabase.from("event_attendees").insert(payload);
    if (!error) {
      setIsGoing(true);
      setPickingDate(false);
      router.refresh();
    }
  }

  async function handleClick(occurrenceStartTime?: string) {
    setLoading(true);
    try {
      const profile = await getCurrentUserProfile();
      if (!profile) {
        router.push("/login");
        return;
      }
      const hasPhone = !!profile?.phone_number?.trim();
      const doRsvp = () => rsvp(profile.id, occurrenceStartTime);
      if (!hasPhone) {
        openModal({
          source: "join_event",
          onComplete: doRsvp,
        });
        return;
      }
      await doRsvp();
    } finally {
      setLoading(false);
    }
  }

  if (!checked) {
    return (
      <Button size="lg" variant="green" className="min-w-[120px]" disabled>
        ...
      </Button>
    );
  }

  if (isGoing) {
    return (
      <Button size="lg" variant="green" className="min-w-[120px]" disabled>
        {t("events.youreGoing")}
      </Button>
    );
  }

  if (isRecurring && nextOccurrences && nextOccurrences.length > 0 && pickingDate) {
    return (
      <div className="flex flex-col gap-2 min-w-[200px]">
        <p className="text-sm font-medium text-foreground">{t("events.rsvpPickDate")}</p>
        <div className="flex flex-col gap-1.5">
          {nextOccurrences.map((occ) => (
            <Button
              key={occ.startTime}
              size="sm"
              variant="outline"
              className="justify-start text-left"
              onClick={() => handleClick(occ.startTime)}
              disabled={loading}
            >
              {occ.label}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setPickingDate(false)}>
          {t("common.cancel")}
        </Button>
      </div>
    );
  }

  if (isRecurring && nextOccurrences && nextOccurrences.length > 0) {
    return (
      <Button
        size="lg"
        variant="green"
        className="min-w-[120px]"
        onClick={() => setPickingDate(true)}
        disabled={loading}
      >
        {t("events.rsvp")}
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      variant="green"
      className="min-w-[120px]"
      onClick={() => handleClick()}
      disabled={loading}
    >
      {loading ? "..." : t("events.rsvp")}
    </Button>
  );
}
