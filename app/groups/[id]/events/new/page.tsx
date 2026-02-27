"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getGroupById, canManageGroup } from "@/lib/groups";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { eventFormSchema, type EventFormValues } from "@/lib/event-form-schema";
import { getNthWeekdayInMonth } from "@/lib/events";
import { parseDateMDY } from "@/components/date-masked-input";
import { EventFormContent } from "@/components/event-form-content";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
const COVERS_BUCKET = "covers";

type Category = { id: string; name: string; slug: string };

export default function NewEventPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [groupName, setGroupName] = React.useState<string | null>(null);
  const [groupCategoryId, setGroupCategoryId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [unauthorized, setUnauthorized] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
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
    (async () => {
      const [groupData, profile] = await Promise.all([
        getGroupById(params.id),
        getCurrentUserProfile(),
      ]);
      if (!groupData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!profile?.id || !(await canManageGroup(params.id, profile.id))) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }
      setGroupName(groupData.name);
      setGroupCategoryId(groupData.groupCategoryId);
      setLoading(false);
    })();
  }, [params.id]);

  // Default event theme to group category (admin form)
  React.useEffect(() => {
    if (groupCategoryId) form.setValue("event_theme_id", groupCategoryId);
  }, [groupCategoryId, form]);

  React.useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, slug, emoji")
        .order("name");
      setCategories(data ?? []);
    })();
  }, []);

  function validateCoverFile(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type))
      return "Please upload a JPG, PNG, or GIF image.";
    if (file.size > MAX_IMAGE_BYTES)
      return "Image must be 5MB or smaller.";
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
    const { data: urlData } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(name);
    return urlData.publicUrl;
  }

  async function onSubmit(values: EventFormValues) {
    setError(null);
    if (bannerFile) {
      const err = validateCoverFile(bannerFile);
      if (err) {
        setError(err);
        return;
      }
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
          setError("Invalid date. Use MM-DD-YYYY.");
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
      if (bannerFile) {
        bannerImageUrl = await uploadImage(bannerFile, "events");
      }
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
        host_group_id: params.id,
      };
      if (recurrenceWeekday !== null) (insertPayload as Record<string, number | null>).recurrence_weekday = recurrenceWeekday;
      if (recurrenceWeekOfMonth !== null) (insertPayload as Record<string, number | null>).recurrence_week_of_month = recurrenceWeekOfMonth;

      const { error: eventError } = await supabase.from("events").insert(insertPayload);

      if (eventError) {
        setError(eventError.message);
        setSubmitting(false);
        return;
      }
      router.push(`/groups/${params.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-muted-foreground">Only the group organizer can create events here.</p>
        <Button asChild variant="outline">
          <Link href={`/groups/${params.id}`}>Back to group</Link>
        </Button>
      </main>
    );
  }

  if (notFound || !groupName) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-muted-foreground">Group not found.</p>
        <Button asChild variant="outline">
          <Link href="/groups">Back to Groups</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-xl space-y-8">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/groups/${params.id}`} className="hover:underline">
              {groupName}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            Create an event
          </h1>
        </div>

        <EventFormContent
          form={form}
          categories={categories}
          bannerFile={bannerFile}
          setBannerFile={setBannerFile}
          validateCoverFile={validateCoverFile}
          error={error}
          submitting={submitting}
          cancelHref={`/groups/${params.id}`}
          cancelLabel="Cancel"
          submitLabel={submitting ? "Creating..." : "Create event"}
          onSubmit={onSubmit}
        />
      </div>
    </main>
  );
}
