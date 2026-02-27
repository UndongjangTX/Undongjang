"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { createOrGetConversation } from "@/lib/messenger";
import { useMessenger } from "@/context/messenger-context";
import { t } from "@/lib/i18n";

type Props = (
  | { groupId: string; eventId?: never }
  | { groupId?: never; eventId: string }
) & { iconOnly?: boolean };

export function MessageOrganizerButton(props: Props) {
  const { iconOnly, ...rest } = props;
  const router = useRouter();
  const { openWidget } = useMessenger();
  const [loading, setLoading] = React.useState(false);
  const [show, setShow] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getCurrentUserProfile().then((profile) => {
      if (!cancelled) setShow(!!profile?.id);
    });
    return () => { cancelled = true; };
  }, []);

  async function handleClick() {
    const profile = await getCurrentUserProfile();
    if (!profile?.id) {
      router.push("/login");
      return;
    }
    setLoading(true);
    const result = await createOrGetConversation({
      ...(rest.groupId && { groupId: rest.groupId }),
      ...(rest.eventId && { eventId: rest.eventId }),
      memberUserId: profile.id,
    });
    setLoading(false);
    if (result.ok) {
      openWidget(result.conversationId);
    }
  }

  if (show !== true) return null;

  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-primary-green hover:bg-primary-green/10"
        onClick={handleClick}
        disabled={loading}
        aria-label={loading ? t("common.opening") : t("groups.messageOrganizer")}
        title={loading ? t("common.opening") : t("groups.messageOrganizer")}
      >
        <MessageCircle className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handleClick}
      disabled={loading}
    >
      <MessageCircle className="h-4 w-4" />
      {loading ? t("common.opening") : t("groups.messageOrganizer")}
    </Button>
  );
}
