"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getGroupsUserCanManage } from "@/lib/groups";
import { getEventsUserCanManage } from "@/lib/events";
import { t } from "@/lib/i18n";

type Option = { id: string; name?: string; title?: string };

export default function RequestSpotlightPage() {
  const router = useRouter();
  const [type, setType] = React.useState<"group" | "event">("group");
  const [groups, setGroups] = React.useState<Option[]>([]);
  const [events, setEvents] = React.useState<Option[]>([]);
  const [entityId, setEntityId] = React.useState("");
  const [boostEndDate, setBoostEndDate] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  React.useEffect(() => {
    getCurrentUserProfile().then(async (profile) => {
      if (!profile?.id) {
        router.replace("/login?redirect=" + encodeURIComponent("/request-spotlight"));
        return;
      }
      const [g, e] = await Promise.all([
        getGroupsUserCanManage(profile.id),
        getEventsUserCanManage(profile.id),
      ]);
      setGroups(g);
      setEvents(e.map((x) => ({ id: x.id, title: x.title })));
      setLoading(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const profile = await getCurrentUserProfile();
    if (!profile?.id) {
      setMessage({ type: "error", text: t("requestBoost.mustBeLoggedIn") });
      return;
    }
    const id = type === "group" ? entityId : entityId;
    if (!id) {
      setMessage({ type: "error", text: type === "group" ? t("requestBoost.pleaseSelectGroup") : t("requestBoost.pleaseSelectEvent") });
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("boost_requests").insert({
      type,
      entity_id: id,
      requested_by: profile.id,
      boost_end_date: boostEndDate || null,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    setMessage({ type: "success", text: t("requestBoost.successMessage") });
    setEntityId("");
    setBoostEndDate("");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </main>
    );
  }

  const options = type === "group" ? groups : events;
  const hasOptions = options.length > 0;

  return (
    <main className="min-h-screen">
      <div className="container px-4 py-10 max-w-lg">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-primary-green">{t("requestBoost.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
          {t("requestBoost.description")}
        </p>

        {!hasOptions && (
          <div className="mt-8 rounded-lg border bg-muted/50 p-6">
            <p className="text-sm text-muted-foreground">
              {t("requestBoost.noOptions")}
            </p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/">{t("requestBoost.backToHome")}</Link>
            </Button>
          </div>
        )}

        {hasOptions && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {message && (
              <p className={`text-sm ${message.type === "success" ? "text-primary-green" : "text-destructive"}`}>
                {message.text}
              </p>
            )}
            <div>
              <Label className="mb-2 block">{type === "group" ? t("requestBoost.group") : t("requestBoost.event")} *</Label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => { setType("group"); setEntityId(""); }}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    type === "group" ? "bg-primary-green text-white" : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("requestBoost.group")}
                </button>
                <button
                  type="button"
                  onClick={() => { setType("event"); setEntityId(""); }}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    type === "event" ? "bg-primary-green text-white" : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("requestBoost.event")}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="entity" className="sr-only">{type === "group" ? t("requestBoost.group") : t("requestBoost.event")}</Label>
              <div className="relative mt-1">
                <select
                  id="entity"
                  required
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="flex h-9 w-full appearance-none rounded-full border border-input bg-transparent pl-4 pr-10 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-green [&::-ms-expand]:hidden"
                >
                  <option value="">{type === "group" ? t("requestBoost.selectGroup") : t("requestBoost.selectEvent")}</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {(o as { name?: string; title?: string }).name ?? (o as { name?: string; title?: string }).title ?? o.id}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-green" aria-hidden />
              </div>
            </div>
            <div>
              <Label htmlFor="boost_end_date">{t("requestBoost.boostEndDateOptional")}</Label>
              <DateInput
                id="boost_end_date"
                value={boostEndDate}
                onChange={(v) => setBoostEndDate(v)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("requestBoost.boostEndDateHint")}</p>
            </div>
            <Button type="submit" variant="green" disabled={submitting}>
              {submitting ? t("requestBoost.submitting") : t("requestBoost.submitRequest")}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
