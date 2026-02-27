"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile, hasPhoneNumber } from "@/lib/user-profile";
import { getGroupsOrganizedByUser, type GroupOrganizedByUser } from "@/lib/groups";
import { useOnboarding } from "@/context/onboarding-context";
import { eventFormSchema, type EventFormValues } from "@/lib/event-form-schema";
import { getNthWeekdayInMonth } from "@/lib/events";
import { parseDateMDY } from "@/components/date-masked-input";
import { EventFormContent } from "@/components/event-form-content";
import { t } from "@/lib/i18n";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
const COVERS_BUCKET = "covers";

type Category = { id: string; name: string; slug: string };

export default function StartEventPage() {
  const router = useRouter();
  const { openModal } = useOnboarding();
  const [loading, setLoading] = React.useState(true);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [profileComplete, setProfileComplete] = React.useState(false);
  const [organizedGroups, setOrganizedGroups] = React.useState<GroupOrganizedByUser[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [bannerFile, setBannerFile] = React.useState<File | null>(null);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
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

  React.useEffect(() => {
    const supabase = createClient();
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }
      setUserId(session.user.id);
      const [profile, groups] = await Promise.all([
        getCurrentUserProfile(),
        getGroupsOrganizedByUser(session.user.id),
      ]);
      setProfileComplete(hasPhoneNumber(profile));
      setOrganizedGroups(groups);
      if (groups.length > 0) setSelectedGroupId(groups[0].id);
      setLoading(false);
    }
    init();
  }, []);

  React.useEffect(() => {
    const supabase = createClient();
    supabase
      .from("categories")
      .select("id, name, slug, emoji")
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  // Default event theme to selected group's category when in admin flow
  const selectedGroup = organizedGroups.find((g) => g.id === selectedGroupId);
  React.useEffect(() => {
    if (selectedGroup?.groupCategoryId) {
      form.setValue("event_theme_id", selectedGroup.groupCategoryId);
    }
  }, [selectedGroup?.id, selectedGroup?.groupCategoryId, form]);

  function validateCoverFile(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type))
      return t("startEvent.coverFormatError");
    if (file.size > MAX_IMAGE_BYTES) return t("startEvent.coverSizeError");
    return null;
  }

  async function uploadImage(file: File, path: string): Promise<string | null> {
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const name = `${path}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: err } = await supabase.storage.from(COVERS_BUCKET).upload(name, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (err) return null;
    const { data } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(name);
    return data.publicUrl;
  }

  async function onSubmit(values: EventFormValues) {
    setError(null);
    if (bannerFile && validateCoverFile(bannerFile)) {
      setError(validateCoverFile(bannerFile));
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    try {
      const isRecurring = values.event_type === "Regular" && !!values.repeat_interval;
      let startTime: string;
      let endTime: string | null = null;
      let recurrenceWeekday: number | null = null;
      let recurrenceWeekOfMonth: number | null = null;

      if (isRecurring && values.repeat_interval === "daily" && values.recurrence_start_date && values.start_time_time) {
        const dateStr = parseDateMDY(values.recurrence_start_date);
        if (!dateStr) {
          setError(t("eventForm.startTimeRequired"));
          setSubmitting(false);
          return;
        }
        startTime = new Date(`${dateStr}T${values.start_time_time}:00`).toISOString();
        endTime = values.end_time_time
          ? new Date(`${dateStr}T${values.end_time_time}:00`).toISOString()
          : null;
      } else if (isRecurring && values.repeat_interval === "weekly" && values.recurrence_weekday !== undefined && values.recurrence_weekday !== "" && values.start_time_time) {
        const wd = Number(values.recurrence_weekday);
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let diff = wd - d.getDay();
        if (diff < 0) diff += 7;
        if (diff === 0) diff = 7;
        d.setDate(d.getDate() + diff);
        const dateStr = d.toISOString().slice(0, 10);
        startTime = new Date(`${dateStr}T${values.start_time_time}:00`).toISOString();
        endTime = values.end_time_time
          ? new Date(`${dateStr}T${values.end_time_time}:00`).toISOString()
          : null;
        recurrenceWeekday = wd;
      } else if (isRecurring && values.repeat_interval === "monthly" && values.recurrence_week_of_month !== undefined && values.recurrence_week_of_month !== "" && values.recurrence_weekday !== undefined && values.recurrence_weekday !== "" && values.start_time_time) {
        const weekOfMonth = Number(values.recurrence_week_of_month);
        const wd = Number(values.recurrence_weekday);
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
            cand.setHours(parseInt(values.start_time_time.slice(0, 2), 10), parseInt(values.start_time_time.slice(3, 5), 10), 0, 0);
            if (cand.getTime() >= Date.now()) {
              monthlyStart = cand.toISOString();
              if (values.end_time_time) {
                const endD = new Date(cand);
                endD.setHours(parseInt(values.end_time_time.slice(0, 2), 10), parseInt(values.end_time_time.slice(3, 5), 10), 0, 0);
                monthlyEnd = endD.toISOString();
              } else {
                monthlyEnd = null;
              }
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
        startTime = new Date(values.start_time!).toISOString();
        endTime = values.end_time ? new Date(values.end_time).toISOString() : null;
      }

      const attendeeLimit =
        values.attendee_limit === "" || values.attendee_limit === undefined
          ? null
          : Number(values.attendee_limit);
      let bannerImageUrl: string | null = null;
      if (bannerFile) bannerImageUrl = await uploadImage(bannerFile, "events");
      const recurrenceInterval =
        isRecurring && values.repeat_interval ? values.repeat_interval : null;
      const isOnline = values.location_type === "online";
      const eventAddress = isOnline ? "온라인" : (values.address?.trim() ?? "");
      const meetingUrl = isOnline ? values.meeting_url?.trim() || null : null;

      const insertPayload: Record<string, unknown> = {
        title: values.title.trim(),
        start_time: startTime,
        end_time: endTime,
        event_theme_id: values.event_theme_id,
        event_type: values.event_type,
        privacy: values.privacy ?? "public",
        is_recurring: isRecurring,
        recurrence_interval: recurrenceInterval,
        description: values.description?.trim() || null,
        address: eventAddress,
        meeting_url: meetingUrl,
        banner_image_url: bannerImageUrl,
        attendee_limit: attendeeLimit,
        host_group_id: selectedGroupId,
      };
      if (recurrenceWeekday !== null) (insertPayload as Record<string, number | null>).recurrence_weekday = recurrenceWeekday;
      if (recurrenceWeekOfMonth !== null) (insertPayload as Record<string, number | null>).recurrence_week_of_month = recurrenceWeekOfMonth;

      const { error: eventError } = await supabase.from("events").insert(insertPayload);

      if (eventError) {
        setError(eventError.message);
        setSubmitting(false);
        return;
      }
      if (selectedGroupId) {
        router.push(`/groups/${selectedGroupId}`);
      } else {
        router.push("/events");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("startEvent.somethingWentWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenProfileModal() {
    openModal({
      source: "start_event",
      onComplete: () => {
        getCurrentUserProfile().then((profile) => {
          setProfileComplete(hasPhoneNumber(profile));
        });
      },
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </main>
    );
  }

  if (!userId) {
    router.replace("/login");
    return null;
  }

  if (!profileComplete) {
    return (
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-xl space-y-8">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("startEvent.title")}
          </h1>
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              {t("startEvent.completeProfileFirst")}
            </p>
            <Button className="mt-4" onClick={handleOpenProfileModal}>
              {t("startEvent.completeProfile")}
            </Button>
          </div>
          <Button variant="outline" asChild>
            <Link href="/">{t("common.cancel")}</Link>
          </Button>
        </div>
      </main>
    );
  }

  const isAdminFlow = organizedGroups.length > 0;

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("startEvent.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdminFlow ? t("startEvent.createForOneGroup") : t("startEvent.createEvent")}
          </p>
        </div>

        {isAdminFlow && (
          <div className="space-y-2">
            <Label htmlFor="event-group">{t("startEvent.whichGroup")}</Label>
            <Select
              id="event-group"
              value={selectedGroupId ?? ""}
              onChange={(e) => setSelectedGroupId(e.target.value || null)}
            >
              <option value="">{t("startEvent.noGroup")}</option>
              {organizedGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <EventFormContent
          form={form}
          categories={categories}
          bannerFile={bannerFile}
          setBannerFile={setBannerFile}
          validateCoverFile={validateCoverFile}
          error={error}
          submitting={submitting}
          cancelHref="/"
          cancelLabel={t("common.cancel")}
          submitLabel={submitting ? t("startEvent.creating") : t("startEvent.createEventButton")}
          onSubmit={onSubmit}
        />
      </div>
    </main>
  );
}
