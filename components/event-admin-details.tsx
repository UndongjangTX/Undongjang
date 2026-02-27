"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getEventForEdit, cancelEvent, type EventForEdit } from "@/lib/events";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { ConfirmDestructiveDialog, randomConfirmString } from "@/components/confirm-destructive-dialog";
import { t, privacyLabel, eventTypeLabel } from "@/lib/i18n";
import { getCategoryDisplayName } from "@/lib/category-labels";

const schema = z
  .object({
    title: z.string().min(1, t("eventForm.titleRequired")),
    description: z.string().optional(),
    start_time: z.string().min(1, t("eventForm.startTimeRequired")),
    end_time: z.string().optional(),
    event_type: z.enum(["Lightning", "Regular", "Special"]),
    event_theme_id: z.string().min(1, t("eventForm.themeRequired")),
    location_type: z.enum(["online", "address"]),
    meeting_url: z.string().optional(),
    address: z.string().optional(),
    privacy: z.enum(["public", "private", "exclusive"]),
  })
  .refine((data) => data.location_type !== "online" || !!data.meeting_url?.trim(), {
    message: t("eventForm.meetingUrlRequired"),
    path: ["meeting_url"],
  })
  .refine((data) => data.location_type !== "address" || !!data.address?.trim(), {
    message: t("eventForm.addressRequired"),
    path: ["address"],
  });

type FormValues = z.infer<typeof schema>;

type Category = { id: string; name: string; name_ko?: string | null; slug: string };

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventAdminDetails({
  event,
  onCancelled,
}: {
  event: EventForEdit;
  onCancelled?: () => void;
}) {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [cancelConfirmStr, setCancelConfirmStr] = React.useState("");
  const [cancelLoading, setCancelLoading] = React.useState(false);

  const isOnlineEvent = event.address?.trim().toLowerCase() === "온라인";
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: event.title,
      description: event.description ?? "",
      start_time: toDateTimeLocal(event.start_time),
      end_time: toDateTimeLocal(event.end_time),
      event_type: event.event_type,
      event_theme_id: event.event_theme_id || "",
      location_type: isOnlineEvent ? "online" : "address",
      meeting_url: event.meeting_url ?? "",
      address: isOnlineEvent ? "" : (event.address ?? ""),
      privacy: event.privacy ?? "public",
    },
  });

  React.useEffect(() => {
    const isOnline = event.address?.trim().toLowerCase() === "온라인";
    form.reset({
      title: event.title,
      description: event.description ?? "",
      start_time: toDateTimeLocal(event.start_time),
      end_time: toDateTimeLocal(event.end_time),
      event_type: event.event_type,
      event_theme_id: event.event_theme_id || "",
      location_type: isOnline ? "online" : "address",
      meeting_url: event.meeting_url ?? "",
      address: isOnline ? "" : (event.address ?? ""),
      privacy: event.privacy ?? "public",
    });
  }, [event.id, event.title, event.description, event.start_time, event.end_time, event.event_type, event.event_theme_id, event.address, event.meeting_url, event.privacy, form]);

  React.useEffect(() => {
    const supabase = createClient();
    supabase
      .from("categories")
      .select("id, name, name_ko, slug, emoji")
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  // Re-apply theme when categories finish loading so the dropdown shows the correct option
  React.useEffect(() => {
    if (categories.length > 0 && event.event_theme_id) {
      form.setValue("event_theme_id", event.event_theme_id);
    }
  }, [categories.length, event.event_theme_id, form]);

  async function onSubmit(values: FormValues) {
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const startTime = new Date(values.start_time).toISOString();
    const endTime = values.end_time ? new Date(values.end_time).toISOString() : null;
    const isOnline = values.location_type === "online";
    const eventAddress = isOnline ? "온라인" : (values.address?.trim() ?? "");
    const meetingUrl = isOnline ? values.meeting_url?.trim() || null : null;
    const { error } = await supabase
      .from("events")
      .update({
        title: values.title.trim(),
        description: values.description?.trim() || null,
        privacy: values.privacy,
        start_time: startTime,
        end_time: endTime,
        event_type: values.event_type,
        event_theme_id: values.event_theme_id || null,
        address: eventAddress,
        meeting_url: meetingUrl,
      })
      .eq("id", event.id);

    setSaving(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    setMessage({ type: "success", text: "Event details updated." });
    // Refetch so dropdown shows the saved theme/category
    const updated = await getEventForEdit(event.id);
    if (updated) {
      const isOnline = updated.address?.trim().toLowerCase() === "온라인";
      form.reset({
        title: updated.title,
        description: updated.description ?? "",
        start_time: toDateTimeLocal(updated.start_time),
        end_time: toDateTimeLocal(updated.end_time),
        event_type: updated.event_type,
        event_theme_id: updated.event_theme_id || "",
        location_type: isOnline ? "online" : "address",
        meeting_url: updated.meeting_url ?? "",
        address: isOnline ? "" : (updated.address ?? ""),
        privacy: updated.privacy ?? "public",
      });
    }
  }

  function openCancelDialog() {
    setCancelConfirmStr(randomConfirmString());
    setCancelDialogOpen(true);
  }

  async function handleCancelEvent() {
    setCancelLoading(true);
    const profile = await import("@/lib/user-profile").then((m) => m.getCurrentUserProfile());
    const userId = profile?.id;
    if (!userId) {
      setCancelLoading(false);
      return;
    }
    const result = await cancelEvent(event.id, userId);
    setCancelLoading(false);
    if (result.ok) onCancelled?.();
    else setMessage({ type: "error", text: result.error });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t("admin.eventDetails")}</h2>
      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-primary-green" : "text-destructive"}`}>
          {message.text}
        </p>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">{t("admin.eventTitleLabel")}</Label>
          <Input
            id="title"
            {...form.register("title")}
            placeholder="e.g. Monthly Meetup"
            className="max-w-md"
          />
          {form.formState.errors.title && (
            <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            {...form.register("description")}
            rows={4}
            className="textarea-rounded-box max-w-md"
            placeholder="What's this event about?"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="start_time">{t("admin.startDateAndTime")}</Label>
            <Controller
              control={form.control}
              name="start_time"
              render={({ field }) => (
                <DateTimePicker
                  id="start_time"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="mm/dd/yyyy, --:-- --"
                  aria-label="Event start date and time"
                />
              )}
            />
            {form.formState.errors.start_time && (
              <p className="text-xs text-destructive">{form.formState.errors.start_time.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_time">{t("admin.endDateAndTime")}</Label>
            <Controller
              control={form.control}
              name="end_time"
              render={({ field }) => (
                <DateTimePicker
                  id="end_time"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="mm/dd/yyyy, --:-- --"
                  aria-label="Event end date and time"
                />
              )}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="event_type">{t("eventForm.eventType")}</Label>
          <select
            id="event_type"
            {...form.register("event_type")}
            className="flex h-9 w-full max-w-md rounded-full border border-input bg-transparent px-4 py-1 text-sm"
          >
            <option value="Lightning">{eventTypeLabel("Lightning")}</option>
            <option value="Regular">{eventTypeLabel("Regular")}</option>
            <option value="Special">{eventTypeLabel("Special")}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="event_theme_id">{t("admin.themeCategory")}</Label>
          <select
            id="event_theme_id"
            key={`theme-${event.event_theme_id || "none"}`}
            {...form.register("event_theme_id")}
            className="flex h-9 w-full max-w-md rounded-full border border-input bg-transparent px-4 py-1 text-sm"
          >
            <option value="">{t("admin.selectCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {getCategoryDisplayName(c.name, c.name_ko ?? undefined)}
              </option>
            ))}
          </select>
          {form.formState.errors.event_theme_id && (
            <p className="text-xs text-destructive">{form.formState.errors.event_theme_id.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="privacy">{t("eventForm.privacy")}</Label>
          <select
            id="privacy"
            {...form.register("privacy")}
            className="flex h-9 w-full max-w-md rounded-full border border-input bg-transparent px-4 py-1 text-sm"
          >
            <option value="public">{privacyLabel("public")}</option>
            <option value="private">{privacyLabel("private")}</option>
            <option value="exclusive">{t("groupForm.exclusiveOption")}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>{t("eventForm.eventLocation")}</Label>
          <div className="flex flex-wrap gap-3">
            <label className="cursor-pointer">
              <input
                type="radio"
                value="address"
                {...form.register("location_type")}
                className="sr-only"
              />
              <span
                className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm ${
                  form.watch("location_type") === "address"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background"
                }`}
              >
                {t("eventForm.locationTypeInPerson")}
              </span>
            </label>
            <label className="cursor-pointer">
              <input
                type="radio"
                value="online"
                {...form.register("location_type")}
                className="sr-only"
              />
              <span
                className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm ${
                  form.watch("location_type") === "online"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background"
                }`}
              >
                {t("eventForm.locationTypeOnline")}
              </span>
            </label>
          </div>
          {form.watch("location_type") === "online" && (
            <div className="pt-2 max-w-md">
              <Label htmlFor="meeting_url">{t("eventForm.meetingLinkLabel")}</Label>
              <Input
                id="meeting_url"
                type="url"
                {...form.register("meeting_url")}
                placeholder={t("eventForm.meetingLinkPlaceholder")}
              />
              {form.formState.errors.meeting_url && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.meeting_url.message}</p>
              )}
            </div>
          )}
          {form.watch("location_type") === "address" && (
            <div className="pt-2 max-w-md">
              <Label htmlFor="address">{t("eventForm.addressPlaceholder")}</Label>
              <Input
                id="address"
                {...form.register("address")}
                placeholder={t("eventForm.addressPlaceholder")}
              />
              {form.formState.errors.address && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.address.message}</p>
              )}
            </div>
          )}
        </div>
        <Button type="submit" variant="green" disabled={saving}>
          {saving ? t("admin.saving") : t("admin.saveChanges")}
        </Button>
      </form>

      {!event.cancelled_at && (
        <div className="mt-10 pt-8 border-t space-y-4">
          <h3 className="text-lg font-semibold text-destructive">{t("admin.cancelEvent")}</h3>
          <p className="text-sm text-muted-foreground">
            Cancelling will show a &quot;This event is cancelled&quot; banner on the event page. Boosted status will be removed. The event will remain visible.
          </p>
          <Button variant="destructive" onClick={openCancelDialog}>
            Cancel event
          </Button>
        </div>
      )}

      <ConfirmDestructiveDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel this event?"
        description={
          <>
            <p>{t("admin.cancelEventDesc")}</p>
          </>
        }
        confirmLabel={t("admin.cancelEvent")}
        confirmString={cancelConfirmStr}
        onConfirm={handleCancelEvent}
        loading={cancelLoading}
      />
    </div>
  );
}
