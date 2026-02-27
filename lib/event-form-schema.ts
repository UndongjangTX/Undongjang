import { z } from "zod";
import { t } from "@/lib/i18n";

export const eventFormSchema = z
  .object({
    title: z.string().min(1, t("eventForm.titleRequired")),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    event_theme_id: z.string().min(1, t("eventForm.themeRequired")),
    event_type: z.enum(["Lightning", "Regular"], {
      message: t("eventForm.eventTypeRequired"),
    }),
    privacy: z.enum(["public", "private", "exclusive"], {
      message: t("eventForm.privacyRequired"),
    }),
    repeat_interval: z.enum(["", "daily", "weekly", "monthly"]).optional(),
    /** For daily: YYYY-MM-DD */
    recurrence_start_date: z.string().optional(),
    /** 0=Sun..6=Sat */
    recurrence_weekday: z.string().optional(),
    /** 1=1st..4=4th, 5=last week of month */
    recurrence_week_of_month: z.string().optional(),
    /** HH:mm for recurring */
    start_time_time: z.string().optional(),
    end_time_time: z.string().optional(),
    description: z.string().optional(),
    location_type: z.enum(["online", "address"], {
      message: t("eventForm.locationTypeRequired"),
    }),
    meeting_url: z.string().optional(),
    address: z.string().optional(),
    attendee_limit: z.union([
      z.literal(""),
      z.string().regex(/^\d+$/, t("eventForm.attendeeLimitNumber")),
    ]).optional(),
  })
  .refine(
    (data) => {
      if (data.location_type === "online") {
        return !!data.meeting_url?.trim();
      }
      return true;
    },
    { message: t("eventForm.meetingUrlRequired"), path: ["meeting_url"] }
  )
  .refine(
    (data) => {
      if (data.location_type === "address") {
        return !!data.address?.trim();
      }
      return true;
    },
    { message: t("eventForm.addressRequired"), path: ["address"] }
  )
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
        data.recurrence_week_of_month !== undefined &&
        data.recurrence_week_of_month !== "" &&
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

export type EventFormValues = z.infer<typeof eventFormSchema>;
