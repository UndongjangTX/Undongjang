"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ChevronDown } from "lucide-react";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { DateMaskedInput, parseDateMDY } from "@/components/date-masked-input";
import { TimeWithAMPMInput } from "@/components/time-ampm-input";
import { getNthWeekdayInMonth } from "@/lib/events";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getCategoryDisplayName } from "@/lib/category-labels";
import { t } from "@/lib/i18n";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
const COVERS_BUCKET = "covers";

const step1Schema = z.object({
  name: z.string().min(1, t("groupForm.nameRequired")),
  description: z.string().optional(),
  group_category_id: z.string().min(1, t("groupForm.categoryRequired")),
  location_city: z.string().min(1, t("groupForm.locationRequired")),
  privacy: z.boolean().optional(),
});

const step2Schema = z.object({
  title: z.string().min(1, t("eventForm.titleRequired")),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  event_theme_id: z.string().min(1, t("eventForm.themeRequired")),
  event_type: z.enum(["Lightning", "Regular"], {
    message: t("eventForm.eventTypeRequired"),
  }),
  privacy: z.enum(["public", "private", "exclusive"]),
  repeat_interval: z.enum(["daily", "weekly", "monthly"]).optional(),
  recurrence_start_date: z.string().optional(),
  recurrence_weekday: z.string().optional(),
  recurrence_week_of_month: z.string().optional(),
  start_time_time: z.string().optional(),
  end_time_time: z.string().optional(),
  description: z.string().optional(),
  location_type: z.enum(["online", "address"]),
  meeting_url: z.string().optional(),
  address: z.string().optional(),
  attendee_limit: z.union([
    z.literal(""),
    z.string().regex(/^\d+$/, t("eventForm.attendeeLimitNumber")),
  ]).optional(),
})
  .refine((data) => data.location_type !== "online" || !!data.meeting_url?.trim(), {
    message: t("eventForm.meetingUrlRequired"),
    path: ["meeting_url"],
  })
  .refine((data) => data.location_type !== "address" || !!data.address?.trim(), {
    message: t("eventForm.addressRequired"),
    path: ["address"],
  })
  .refine(
    (data) => {
      if (data.attendee_limit === "" || data.attendee_limit === undefined) return true;
      const n = Number(data.attendee_limit);
      return !Number.isNaN(n) && n > 0;
    },
    { message: t("eventForm.attendeeLimitPositive"), path: ["attendee_limit"] }
  )
  .refine(
    (data) => {
      if (data.event_type !== "Regular") return true;
      return (
        data.repeat_interval === "daily" ||
        data.repeat_interval === "weekly" ||
        data.repeat_interval === "monthly"
      );
    },
    { message: t("eventForm.repeatIntervalRequired"), path: ["repeat_interval"] }
  )
  .refine(
    (data) => {
      if (data.event_type !== "Regular" || data.repeat_interval !== "daily") return true;
      return !!data.recurrence_start_date?.trim() && !!data.start_time_time?.trim();
    },
    { message: t("eventForm.startTimeRequired"), path: ["recurrence_start_date"] }
  )
  .refine(
    (data) => {
      if (data.event_type !== "Regular" || data.repeat_interval !== "weekly") return true;
      return data.recurrence_weekday !== undefined && data.recurrence_weekday !== "" && !!data.start_time_time?.trim();
    },
    { message: t("eventForm.startTimeRequired"), path: ["recurrence_weekday"] }
  )
  .refine(
    (data) => {
      if (data.event_type !== "Regular" || data.repeat_interval !== "monthly") return true;
      return (
        !!data.recurrence_week_of_month?.trim() &&
        data.recurrence_weekday !== undefined &&
        data.recurrence_weekday !== "" &&
        !!data.start_time_time?.trim()
      );
    },
    { message: t("eventForm.startTimeRequired"), path: ["recurrence_week_of_month"] }
  )
  .refine(
    (data) => {
      if (data.event_type === "Regular" && data.repeat_interval) return true;
      return !!data.start_time?.trim();
    },
    { message: t("eventForm.startTimeRequired"), path: ["start_time"] }
  );

type Step1Form = z.infer<typeof step1Schema>;
type Step2Form = z.infer<typeof step2Schema>;

type Category = { id: string; name: string; slug: string };

export default function NewGroupPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [bannerFile, setBannerFile] = React.useState<File | null>(null);

  const step1Form = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: "",
      description: "",
      group_category_id: "",
      location_city: "",
      privacy: false,
    },
  });

  const step2Form = useForm<Step2Form>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      title: "",
      start_time: "",
      end_time: "",
      event_theme_id: "",
      event_type: undefined,
      privacy: "public",
      repeat_interval: "weekly",
      recurrence_start_date: "",
      recurrence_weekday: "",
      recurrence_week_of_month: "",
      start_time_time: "",
      end_time_time: "",
      description: "",
      location_type: "address",
      meeting_url: "",
      address: "",
      attendee_limit: "",
    },
  });

  // Default event theme to Step 1 group category when entering Step 2
  const groupCategoryId = step1Form.watch("group_category_id");
  React.useEffect(() => {
    if (step === 2 && groupCategoryId) {
      step2Form.setValue("event_theme_id", groupCategoryId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when step or groupCategoryId change
  }, [step, groupCategoryId]);

  React.useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase
          .from("categories")
          .select("id, name, slug, emoji")
          .order("name");
        setCategories(data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function validateCoverFile(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type))
      return t("eventForm.coverFormatError");
    if (file.size > MAX_IMAGE_BYTES)
      return t("eventForm.coverSizeError");
    return null;
  }

  async function uploadImage(file: File, path: string): Promise<string | null> {
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const name = `${path}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(COVERS_BUCKET).upload(name, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) return null;
    const { data: urlData } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(name);
    return urlData.publicUrl;
  }

  async function handleStep1Next() {
    const ok = await step1Form.trigger();
    if (!ok) return;
    setError(null);
    setStep(2);
  }

  async function createGroupOnly(): Promise<string | null> {
    const step1Data = step1Form.getValues();
    if (coverFile) {
      const err = validateCoverFile(coverFile);
      if (err) return null;
    }
    const supabase = createClient();
    const profile = await getCurrentUserProfile();
    if (!profile?.id) return null;
    let coverImageUrl: string | null = null;
    if (coverFile) {
      coverImageUrl = await uploadImage(coverFile, "groups");
    }
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .insert({
        name: step1Data.name.trim(),
        description: step1Data.description?.trim() || null,
        group_category_id: step1Data.group_category_id,
        location_city: step1Data.location_city.trim(),
        cover_image_url: coverImageUrl,
        privacy: step1Data.privacy ?? false,
        organizer_id: profile.id,
      })
      .select("id")
      .single();
    if (groupError || !group) return null;
    return group.id;
  }

  async function handleSkipEvent() {
    setError(null);
    setSubmitting(true);
    try {
      const groupId = await createGroupOnly();
      if (!groupId) {
        setError(t("groupForm.failedCreateGroup"));
        setSubmitting(false);
        return;
      }
      router.push(`/groups/${groupId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("groupForm.somethingWentWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    const step1Ok = await step1Form.trigger();
    const step2Ok = await step2Form.trigger();
    if (!step1Ok || !step2Ok) return;

    const step1Data = step1Form.getValues();
    const step2Data = step2Form.getValues();

    if (coverFile) {
      const err = validateCoverFile(coverFile);
      if (err) {
        setError(err);
        return;
      }
    }
    if (bannerFile) {
      const err = validateCoverFile(bannerFile);
      if (err) {
        setError(err);
        return;
      }
    }

    setSubmitting(true);
    const supabase = createClient();
    const profile = await getCurrentUserProfile();
    if (!profile?.id) {
      setError(t("groupForm.mustBeSignedIn"));
      setSubmitting(false);
      return;
    }

    try {
      let coverImageUrl: string | null = null;
      if (coverFile) {
        coverImageUrl = await uploadImage(coverFile, "groups");
        if (!coverImageUrl) setError(t("groupForm.failedUploadCover"));
      }

      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: step1Data.name.trim(),
          description: step1Data.description?.trim() || null,
          group_category_id: step1Data.group_category_id,
          location_city: step1Data.location_city.trim(),
          cover_image_url: coverImageUrl,
          privacy: step1Data.privacy ?? false,
          organizer_id: profile.id,
        })
        .select("id")
        .single();

      if (groupError || !group) {
        setError(groupError?.message ?? t("groupForm.failedCreateGroup"));
        setSubmitting(false);
        return;
      }

      const isRecurring = step2Data.event_type === "Regular" && !!step2Data.repeat_interval;
      let startTime: string;
      let endTime: string | null = null;
      let recurrenceWeekday: number | null = null;
      let recurrenceWeekOfMonth: number | null = null;

      if (isRecurring && step2Data.repeat_interval === "daily" && step2Data.recurrence_start_date && step2Data.start_time_time) {
        const dateStr = parseDateMDY(step2Data.recurrence_start_date);
        if (!dateStr) {
          setError(t("eventForm.startTimeRequired"));
          setSubmitting(false);
          return;
        }
        startTime = new Date(`${dateStr}T${step2Data.start_time_time}:00`).toISOString();
        endTime = step2Data.end_time_time
          ? new Date(`${dateStr}T${step2Data.end_time_time}:00`).toISOString()
          : null;
      } else if (isRecurring && step2Data.repeat_interval === "weekly" && step2Data.recurrence_weekday !== undefined && step2Data.recurrence_weekday !== "" && step2Data.start_time_time) {
        const wd = Number(step2Data.recurrence_weekday);
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let diff = wd - d.getDay();
        if (diff < 0) diff += 7;
        if (diff === 0) diff = 7;
        d.setDate(d.getDate() + diff);
        const dateStr = d.toISOString().slice(0, 10);
        startTime = new Date(`${dateStr}T${step2Data.start_time_time}:00`).toISOString();
        endTime = step2Data.end_time_time
          ? new Date(`${dateStr}T${step2Data.end_time_time}:00`).toISOString()
          : null;
        recurrenceWeekday = wd;
      } else if (isRecurring && step2Data.repeat_interval === "monthly" && step2Data.recurrence_week_of_month && step2Data.recurrence_weekday !== undefined && step2Data.recurrence_weekday !== "" && step2Data.start_time_time) {
        const weekOfMonth = Number(step2Data.recurrence_week_of_month);
        const wd = Number(step2Data.recurrence_weekday);
        const now = new Date();
        let monthlyStart: string | null = null;
        let monthlyEnd: string | null = null;
        for (let m = 0; m < 24; m++) {
          const y = now.getFullYear();
          const mon = now.getMonth() + m;
          const yr = y + Math.floor(mon / 12);
          const mo = mon % 12;
          const cand = getNthWeekdayInMonth(yr, mo, weekOfMonth, wd);
          if (cand) {
            cand.setHours(parseInt(step2Data.start_time_time.slice(0, 2), 10), parseInt(step2Data.start_time_time.slice(3, 5), 10), 0, 0);
            if (cand.getTime() >= Date.now()) {
              monthlyStart = cand.toISOString();
              monthlyEnd = step2Data.end_time_time
                ? (() => {
                    const endD = new Date(cand);
                    endD.setHours(parseInt(step2Data.end_time_time!.slice(0, 2), 10), parseInt(step2Data.end_time_time!.slice(3, 5), 10), 0, 0);
                    return endD.toISOString();
                  })()
                : null;
              recurrenceWeekday = wd;
              recurrenceWeekOfMonth = weekOfMonth;
              break;
            }
          }
        }
        if (!monthlyStart) {
          setError("Could not compute next monthly occurrence.");
          setSubmitting(false);
          return;
        }
        startTime = monthlyStart;
        endTime = monthlyEnd;
      } else {
        startTime = new Date(step2Data.start_time!).toISOString();
        endTime = step2Data.end_time ? new Date(step2Data.end_time).toISOString() : null;
      }

      const attendeeLimit =
        step2Data.attendee_limit === "" || step2Data.attendee_limit === undefined
          ? null
          : Number(step2Data.attendee_limit);

      let bannerImageUrl: string | null = null;
      if (bannerFile) {
        bannerImageUrl = await uploadImage(bannerFile, "events");
      }

      const recurrenceInterval =
        isRecurring && step2Data.repeat_interval ? step2Data.repeat_interval : null;
      const isOnline = step2Data.location_type === "online";
      const eventAddress = isOnline ? "온라인" : (step2Data.address?.trim() ?? "");
      const meetingUrl = isOnline ? step2Data.meeting_url?.trim() || null : null;

      const insertPayload: Record<string, unknown> = {
        title: step2Data.title.trim(),
        start_time: startTime,
        end_time: endTime,
        event_theme_id: step2Data.event_theme_id,
        event_type: step2Data.event_type,
        privacy: step2Data.privacy ?? "public",
        is_recurring: isRecurring,
        recurrence_interval: recurrenceInterval,
        description: step2Data.description?.trim() || null,
        address: eventAddress,
        meeting_url: meetingUrl,
        banner_image_url: bannerImageUrl,
        attendee_limit: attendeeLimit,
        host_group_id: group.id,
      };
      if (recurrenceWeekday !== null) (insertPayload as Record<string, number | null>).recurrence_weekday = recurrenceWeekday;
      if (recurrenceWeekOfMonth !== null) (insertPayload as Record<string, number | null>).recurrence_week_of_month = recurrenceWeekOfMonth;

      const { error: eventError } = await supabase.from("events").insert(insertPayload);

      if (eventError) {
        setError(eventError.message);
        setSubmitting(false);
        return;
      }

      router.push(`/groups/${group.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("groupForm.somethingWentWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("groupForm.loading")}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("groupForm.stepTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 1 ? t("groupForm.stepSub") : t("groupForm.stepSub2")}
          </p>
        </div>

        {step === 1 && (
          <form
            onSubmit={step1Form.handleSubmit(handleStep1Next)}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label htmlFor="name">{t("groupForm.groupName")}</Label>
              <Input
                id="name"
                {...step1Form.register("name")}
                placeholder={t("groupForm.namePlaceholder")}
              />
              {step1Form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {step1Form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("groupForm.introduceGroup")}</Label>
              <textarea
                id="description"
                {...step1Form.register("description")}
                rows={4}
                className="textarea-rounded-box"
                placeholder={t("groupForm.descriptionPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group_category_id">{t("groupForm.groupCategory")}</Label>
              <div className="relative">
                <select
                  id="group_category_id"
                  {...step1Form.register("group_category_id")}
                  className="flex h-9 w-full appearance-none rounded-full border border-input bg-transparent pl-4 pr-10 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-green [&::-ms-expand]:hidden"
                >
                  <option value="">{t("groupForm.selectCategory")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {getCategoryDisplayName(c.name, c.name_ko ?? undefined)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-green" aria-hidden />
              </div>
              {step1Form.formState.errors.group_category_id && (
                <p className="text-xs text-destructive">
                  {step1Form.formState.errors.group_category_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_city">{t("groupForm.location")}</Label>
              <Input
                id="location_city"
                {...step1Form.register("location_city")}
                placeholder={t("groupForm.locationPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("groupForm.locationHint")}
              </p>
              {step1Form.formState.errors.location_city && (
                <p className="text-xs text-destructive">
                  {step1Form.formState.errors.location_city.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("groupForm.uploadCover")}</Label>
              <Input
                type="file"
                accept=".jpg,.jpeg,.png,.gif"
                onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                {t("groupForm.coverHint")}
              </p>
              {coverFile && validateCoverFile(coverFile) && (
                <p className="text-xs text-destructive">{validateCoverFile(coverFile)}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="privacy"
                  checked={step1Form.watch("privacy")}
                  onCheckedChange={(c) => step1Form.setValue("privacy", c === true)}
                />
                <Label htmlFor="privacy" className="text-sm font-normal cursor-pointer">
                  {t("groupForm.makePrivate")}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("groupForm.privateHint")}
              </p>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" asChild>
                <Link href="/groups">{t("groupForm.cancel")}</Link>
              </Button>
              <Button type="submit">{t("groupForm.nextCreateEvent")}</Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkipEvent}
                disabled={submitting}
                className="text-muted-foreground"
              >
                {t("groupForm.notReadyYet")}
              </Button>
            </div>
            <form
              onSubmit={step2Form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
            <div className="space-y-2">
              <Label htmlFor="title">{t("eventForm.eventName")}</Label>
              <Input
                id="title"
                {...step2Form.register("title")}
                placeholder={t("eventForm.titlePlaceholder")}
              />
              {step2Form.formState.errors.title && (
                <p className="text-xs text-destructive">
                  {step2Form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("eventForm.eventType")}</Label>
              <div className="flex flex-wrap gap-3">
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    value="Lightning"
                    {...step2Form.register("event_type")}
                    className="sr-only"
                  />
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                      step2Form.watch("event_type") === "Lightning"
                        ? "border-transparent bg-primary-green text-white"
                        : "border-primary-green bg-white text-foreground"
                    }`}
                  >
                    {step2Form.watch("event_type") === "Lightning" && (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                    {t("eventForm.lightningEvent")}
                  </span>
                </label>
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    value="Regular"
                    {...step2Form.register("event_type")}
                    className="sr-only"
                  />
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                      step2Form.watch("event_type") === "Regular"
                        ? "border-transparent bg-primary-green text-white"
                        : "border-primary-green bg-white text-foreground"
                    }`}
                  >
                    {step2Form.watch("event_type") === "Regular" && (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                    {t("eventForm.groupRegularEvents")}
                  </span>
                </label>
              </div>
              {step2Form.formState.errors.event_type && (
                <p className="text-xs text-destructive">
                  {step2Form.formState.errors.event_type.message}
                </p>
              )}
            </div>

            {step2Form.watch("event_type") === "Regular" && (
              <div className="space-y-2">
                <Label htmlFor="repeat_interval">{t("eventForm.repeat")}</Label>
                <div className="relative">
                  <select
                    id="repeat_interval"
                    {...step2Form.register("repeat_interval")}
                    className="flex h-9 w-full appearance-none rounded-full border-2 border-primary-green bg-white pl-4 pr-10 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-green [&::-ms-expand]:hidden"
                  >
                    <option value="daily">{t("eventForm.daily")}</option>
                    <option value="weekly">{t("eventForm.weekly")}</option>
                    <option value="monthly">{t("eventForm.monthly")}</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-green" aria-hidden />
                </div>
                {step2Form.formState.errors.repeat_interval && (
                  <p className="text-xs text-destructive">
                    {step2Form.formState.errors.repeat_interval.message}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="event_theme_id">{t("eventForm.eventTheme")}</Label>
              <div className="relative">
                <select
                  id="event_theme_id"
                  {...step2Form.register("event_theme_id")}
                  className="flex h-9 w-full appearance-none rounded-full border border-input bg-transparent pl-4 pr-10 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-green [&::-ms-expand]:hidden"
                >
                  <option value="">{t("eventForm.selectTheme")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {getCategoryDisplayName(c.name, c.name_ko ?? undefined)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-green" aria-hidden />
              </div>
              {step2Form.formState.errors.event_theme_id && (
                <p className="text-xs text-destructive">
                  {step2Form.formState.errors.event_theme_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("groupForm.eventPrivacy")}</Label>
              <div className="relative">
                <select
                  id="event_privacy"
                  {...step2Form.register("privacy")}
                  className="flex h-9 w-full appearance-none rounded-full border border-input bg-transparent pl-4 pr-10 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-green [&::-ms-expand]:hidden"
                >
                  <option value="public">{t("privacy.public")}</option>
                  <option value="private">{t("privacy.private")}</option>
                  <option value="exclusive">{t("groupForm.exclusiveOption")}</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-green" aria-hidden />
              </div>
            </div>

            {step2Form.watch("event_type") !== "Regular" || !step2Form.watch("repeat_interval") ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">{t("eventForm.eventTimeDate")}</Label>
                  <Controller
                    control={step2Form.control}
                    name="start_time"
                    render={({ field }) => (
                      <DateTimePicker
                        id="start_time"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={t("eventForm.dateTimePlaceholder")}
                        aria-label={t("eventForm.startTimeAria")}
                      />
                    )}
                  />
                  {step2Form.formState.errors.start_time && (
                    <p className="text-xs text-destructive">
                      {step2Form.formState.errors.start_time.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">{t("eventForm.endTime")}</Label>
                  <Controller
                    control={step2Form.control}
                    name="end_time"
                    render={({ field }) => (
                      <DateTimePicker
                        id="end_time"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder={t("eventForm.dateTimePlaceholder")}
                        aria-label={t("eventForm.endTimeAria")}
                      />
                    )}
                  />
                </div>
              </div>
            ) : (
              <>
                {step2Form.watch("repeat_interval") === "daily" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recurrence_start_date">{t("eventForm.recurrenceStartDate")} *</Label>
                      <Controller
                        control={step2Form.control}
                        name="recurrence_start_date"
                        render={({ field }) => (
                          <DateMaskedInput
                            id="recurrence_start_date"
                            placeholder="MM-DD-YYYY"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start_time_time">{t("eventForm.startTime")} *</Label>
                        <Controller
                          control={step2Form.control}
                          name="start_time_time"
                          render={({ field }) => (
                            <TimeWithAMPMInput
                              id="start_time_time"
                              placeholder="__:__"
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_time_time">{t("eventForm.endTime")}</Label>
                        <Controller
                          control={step2Form.control}
                          name="end_time_time"
                          render={({ field }) => (
                            <TimeWithAMPMInput
                              id="end_time_time"
                              placeholder="__:__"
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {step2Form.watch("repeat_interval") === "weekly" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recurrence_weekday">{t("eventForm.recurrenceWeekday")} *</Label>
                      <select
                        id="recurrence_weekday"
                        {...step2Form.register("recurrence_weekday")}
                        className="flex h-9 w-full appearance-none rounded-full border-2 border-primary-green bg-white pl-4 pr-10 py-1 text-sm [&::-ms-expand]:hidden"
                      >
                        <option value="">{t("eventForm.selectWeekday")}</option>
                        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                          <option key={d} value={d}>{t(`eventForm.weekday${d}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start_time_time">{t("eventForm.startTime")} *</Label>
                        <Controller
                          control={step2Form.control}
                          name="start_time_time"
                          render={({ field }) => (
                            <TimeWithAMPMInput
                              id="start_time_time"
                              placeholder="__:__"
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_time_time">{t("eventForm.endTime")}</Label>
                        <Controller
                          control={step2Form.control}
                          name="end_time_time"
                          render={({ field }) => (
                            <TimeWithAMPMInput
                              id="end_time_time"
                              placeholder="__:__"
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {step2Form.watch("repeat_interval") === "monthly" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="recurrence_week_of_month">{t("eventForm.recurrenceWeekOfMonth")} *</Label>
                        <select
                          id="recurrence_week_of_month"
                          {...step2Form.register("recurrence_week_of_month")}
                          className="flex h-9 w-full appearance-none rounded-full border-2 border-primary-green bg-white pl-4 pr-10 py-1 text-sm [&::-ms-expand]:hidden"
                        >
                          <option value="">{t("eventForm.selectWeek")}</option>
                          <option value="1">{t("eventForm.week1")}</option>
                          <option value="2">{t("eventForm.week2")}</option>
                          <option value="3">{t("eventForm.week3")}</option>
                          <option value="4">{t("eventForm.week4")}</option>
                          <option value="5">{t("eventForm.weekLast")}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="recurrence_weekday">{t("eventForm.recurrenceWeekday")} *</Label>
                        <select
                          id="recurrence_weekday"
                          {...step2Form.register("recurrence_weekday")}
                          className="flex h-9 w-full appearance-none rounded-full border-2 border-primary-green bg-white pl-4 pr-10 py-1 text-sm [&::-ms-expand]:hidden"
                        >
                          <option value="">{t("eventForm.selectWeekday")}</option>
                          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                            <option key={d} value={d}>{t(`eventForm.weekday${d}`)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start_time_time">{t("eventForm.startTime")} *</Label>
                        <Controller
                          control={step2Form.control}
                          name="start_time_time"
                          render={({ field }) => (
                            <TimeWithAMPMInput
                              id="start_time_time"
                              placeholder="__:__"
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_time_time">{t("eventForm.endTime")}</Label>
                        <Controller
                          control={step2Form.control}
                          name="end_time_time"
                          render={({ field }) => (
                            <TimeWithAMPMInput
                              id="end_time_time"
                              placeholder="__:__"
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="event_description">{t("eventForm.introduceEvent")}</Label>
              <textarea
                id="event_description"
                {...step2Form.register("description")}
                rows={4}
                className="textarea-rounded-box"
                placeholder={t("eventForm.descriptionPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("eventForm.eventLocation")}</Label>
              <div className="flex flex-wrap gap-3">
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    value="address"
                    {...step2Form.register("location_type")}
                    className="sr-only"
                  />
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                      step2Form.watch("location_type") === "address"
                        ? "border-transparent bg-primary-green text-white"
                        : "border-primary-green bg-white text-foreground"
                    }`}
                  >
                    {step2Form.watch("location_type") === "address" && (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                    {t("eventForm.locationTypeInPerson")}
                  </span>
                </label>
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    value="online"
                    {...step2Form.register("location_type")}
                    className="sr-only"
                  />
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                      step2Form.watch("location_type") === "online"
                        ? "border-transparent bg-primary-green text-white"
                        : "border-primary-green bg-white text-foreground"
                    }`}
                  >
                    {step2Form.watch("location_type") === "online" && (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                    {t("eventForm.locationTypeOnline")}
                  </span>
                </label>
              </div>
              {step2Form.watch("location_type") === "online" && (
                <div className="pt-2">
                  <Label htmlFor="meeting_url">{t("eventForm.meetingLinkLabel")}</Label>
                  <Input
                    id="meeting_url"
                    type="url"
                    {...step2Form.register("meeting_url")}
                    placeholder={t("eventForm.meetingLinkPlaceholder")}
                  />
                  {step2Form.formState.errors.meeting_url && (
                    <p className="text-xs text-destructive mt-1">
                      {step2Form.formState.errors.meeting_url.message}
                    </p>
                  )}
                </div>
              )}
              {step2Form.watch("location_type") === "address" && (
                <div className="pt-2">
                  <Label htmlFor="address">{t("eventForm.addressPlaceholder")}</Label>
                  <Input
                    id="address"
                    {...step2Form.register("address")}
                    placeholder={t("eventForm.addressPlaceholder")}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("groupForm.addressHintWithMaps")}
                  </p>
                  {step2Form.formState.errors.address && (
                    <p className="text-xs text-destructive mt-1">
                      {step2Form.formState.errors.address.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("eventForm.uploadCover")}</Label>
              <Input
                type="file"
                accept=".jpg,.jpeg,.png,.gif"
                onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                {t("groupForm.coverHint")}
              </p>
              {bannerFile && validateCoverFile(bannerFile) && (
                <p className="text-xs text-destructive">{validateCoverFile(bannerFile)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendee_limit">{t("eventForm.attendeeLimit")}</Label>
              <div className="flex flex-wrap gap-3 items-center">
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    checked={step2Form.watch("attendee_limit") === ""}
                    onChange={() => step2Form.setValue("attendee_limit", "")}
                    className="sr-only"
                  />
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                      step2Form.watch("attendee_limit") === "" ||
                      step2Form.watch("attendee_limit") === undefined
                        ? "border-transparent bg-primary-green text-white"
                        : "border-primary-green bg-white text-foreground"
                    }`}
                  >
                    {(step2Form.watch("attendee_limit") === "" ||
                      step2Form.watch("attendee_limit") === undefined) && (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                    {t("eventForm.noLimit")}
                  </span>
                </label>
                <label className="cursor-pointer inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={
                      step2Form.watch("attendee_limit") !== "" &&
                      step2Form.watch("attendee_limit") !== undefined
                    }
                    onChange={() => step2Form.setValue("attendee_limit", "50")}
                    className="sr-only"
                  />
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                      step2Form.watch("attendee_limit") !== "" &&
                      step2Form.watch("attendee_limit") !== undefined
                        ? "border-transparent bg-primary-green text-white"
                        : "border-primary-green bg-white text-foreground"
                    }`}
                  >
                    {step2Form.watch("attendee_limit") !== "" &&
                      step2Form.watch("attendee_limit") !== undefined && (
                        <Check className="h-4 w-4 shrink-0" />
                      )}
                    {t("eventForm.limitTo")}
                  </span>
                </label>
                <Input
                  id="attendee_limit"
                  type="number"
                  min={1}
                  className="w-24"
                  value={
                    (() => {
                      const v = step2Form.watch("attendee_limit");
                      if (v === "" || v === undefined) return "";
                      return typeof v === "number" ? String(v) : v;
                    })()
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    step2Form.setValue("attendee_limit", v === "" ? "" : v);
                  }}
                />
                <span className="text-sm text-muted-foreground">{t("eventForm.attendees")}</span>
              </div>
              {step2Form.formState.errors.attendee_limit && (
                <p className="text-xs text-destructive">
                  {step2Form.formState.errors.attendee_limit.message}
                </p>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
              >
                {t("groupForm.back")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? t("groupForm.creating") : t("groupForm.createGroupAndEvent")}
              </Button>
            </div>
          </form>
          </div>
        )}
      </div>
    </main>
  );
}
