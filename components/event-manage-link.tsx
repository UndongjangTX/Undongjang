"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { canManageEvent } from "@/lib/events";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { t } from "@/lib/i18n";

export function EventManageLink({ eventId }: { eventId: string }) {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    getCurrentUserProfile().then(async (profile) => {
      if (!profile?.id) {
        setShow(false);
        return;
      }
      setShow(await canManageEvent(eventId, profile.id));
    });
  }, [eventId]);

  if (!show) return null;

  return (
    <Button variant="outline" size="lg" className="min-w-[120px]" asChild>
      <Link href={`/events/${eventId}/admin`}>{t("events.manageEvent")}</Link>
    </Button>
  );
}
