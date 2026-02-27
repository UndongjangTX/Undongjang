"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { DateMaskedInput } from "@/components/date-masked-input";
import { TimeWithAMPMInput } from "@/components/time-ampm-input";
import { Check } from "lucide-react";
import { Select } from "@/components/ui/select";
import type { EventFormValues } from "@/lib/event-form-schema";
import { t, privacyLabel } from "@/lib/i18n";
import { getCategoryDisplayName } from "@/lib/category-labels";

type Category = { id: string; name: string; name_ko?: string | null; slug: string };

type Props = {
  form: UseFormReturn<EventFormValues>;
  categories: Category[];
  bannerFile: File | null;
  setBannerFile: (f: File | null) => void;
  validateCoverFile: (f: File) => string | null;
  error: string | null;
  submitting: boolean;
  cancelHref: string;
  cancelLabel: string;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => void | Promise<void>;
  children?: React.ReactNode;
};

export function EventFormContent({
  form,
  categories,
  bannerFile,
  setBannerFile,
  validateCoverFile,
  error,
  submitting,
  cancelHref,
  cancelLabel,
  submitLabel,
  onSubmit,
  children,
}: Props) {
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" id="event-form">
      {children}
      <div className="space-y-2">
        <Label htmlFor="title">{t("eventForm.eventName")}</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder={t("eventForm.titlePlaceholder")}
        />
        {form.formState.errors.title && (
          <p className="text-xs text-destructive">
            {form.formState.errors.title.message}
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
              {...form.register("event_type")}
              className="sr-only"
            />
            <span
              className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                form.watch("event_type") === "Lightning"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground"
              }`}
            >
              {form.watch("event_type") === "Lightning" && (
                <Check className="h-4 w-4 shrink-0" />
              )}
              {t("eventForm.lightningEvent")}
            </span>
          </label>
          <label className="cursor-pointer">
            <input
              type="radio"
              value="Regular"
              {...form.register("event_type")}
              className="sr-only"
            />
            <span
              className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                form.watch("event_type") === "Regular"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground"
              }`}
            >
              {form.watch("event_type") === "Regular" && (
                <Check className="h-4 w-4 shrink-0" />
              )}
              {t("eventForm.groupRegularEvents")}
            </span>
          </label>
        </div>
        {form.formState.errors.event_type && (
          <p className="text-xs text-destructive">
            {form.formState.errors.event_type.message}
          </p>
        )}
      </div>

      {form.watch("event_type") === "Regular" && (
        <div className="space-y-2">
          <Label htmlFor="repeat_interval">{t("eventForm.repeat")}</Label>
          <Select id="repeat_interval" variant="green" {...form.register("repeat_interval")}>
            <option value="daily">{t("eventForm.daily")}</option>
            <option value="weekly">{t("eventForm.weekly")}</option>
            <option value="monthly">{t("eventForm.monthly")}</option>
          </Select>
          {form.formState.errors.repeat_interval && (
            <p className="text-xs text-destructive">
              {form.formState.errors.repeat_interval.message}
            </p>
          )}
        </div>
      )}

      {/* 일시 · 종료 시간: 반복 바로 아래. Lightning/비반복 = 전체 일시, 반복 = 구간별 입력 */}
      {form.watch("event_type") !== "Regular" || !form.watch("repeat_interval") ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start_time">{t("eventForm.eventTimeDate")}</Label>
            <Controller
              control={form.control}
              name="start_time"
              render={({ field }) => (
                <DateTimePicker
                  id="start_time"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder={t("eventForm.dateTimePlaceholder")}
                  aria-label={t("eventForm.startTimeAria")}
                />
              )}
            />
            {form.formState.errors.start_time && (
              <p className="text-xs text-destructive">
                {form.formState.errors.start_time.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_time">{t("eventForm.endTime")}</Label>
            <Controller
              control={form.control}
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
          {form.watch("repeat_interval") === "daily" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recurrence_start_date">{t("eventForm.recurrenceStartDate")} *</Label>
                <Controller
                  control={form.control}
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
                    control={form.control}
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
                    control={form.control}
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
          {form.watch("repeat_interval") === "weekly" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recurrence_weekday">{t("eventForm.recurrenceWeekday")} *</Label>
                <Select id="recurrence_weekday" {...form.register("recurrence_weekday")}>
                  <option value="">{t("eventForm.selectWeekday")}</option>
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <option key={d} value={d}>
                      {t(`eventForm.weekday${d}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time_time">{t("eventForm.startTime")} *</Label>
                  <Controller
                    control={form.control}
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
                    control={form.control}
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
          {form.watch("repeat_interval") === "monthly" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recurrence_week_of_month">{t("eventForm.recurrenceWeekOfMonth")} *</Label>
                  <Select id="recurrence_week_of_month" {...form.register("recurrence_week_of_month")}>
                    <option value="">{t("eventForm.selectWeek")}</option>
                    <option value="1">{t("eventForm.week1")}</option>
                    <option value="2">{t("eventForm.week2")}</option>
                    <option value="3">{t("eventForm.week3")}</option>
                    <option value="4">{t("eventForm.week4")}</option>
                    <option value="5">{t("eventForm.weekLast")}</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurrence_weekday">{t("eventForm.recurrenceWeekday")} *</Label>
                  <Select id="recurrence_weekday" {...form.register("recurrence_weekday")}>
                    <option value="">{t("eventForm.selectWeekday")}</option>
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                      <option key={d} value={d}>
                        {t(`eventForm.weekday${d}`)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time_time">{t("eventForm.startTime")} *</Label>
                  <Controller
                    control={form.control}
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
                    control={form.control}
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
        <Label htmlFor="event_theme_id">{t("eventForm.eventTheme")}</Label>
        <Select id="event_theme_id" {...form.register("event_theme_id")}>
          <option value="">{t("eventForm.selectTheme")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {getCategoryDisplayName(c.name, c.name_ko ?? undefined)}
            </option>
          ))}
        </Select>
        {form.formState.errors.event_theme_id && (
          <p className="text-xs text-destructive">
            {form.formState.errors.event_theme_id.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t("eventForm.privacy")}</Label>
        <div className="flex flex-wrap gap-3">
          {(["public", "private", "exclusive"] as const).map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                value={value}
                {...form.register("privacy")}
                className="sr-only"
              />
              <span
                className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                  form.watch("privacy") === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-foreground"
                }`}
              >
                {form.watch("privacy") === value && <Check className="h-4 w-4 shrink-0" />}
                {privacyLabel(value)}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("eventForm.privacyHint")}
        </p>
        {form.formState.errors.privacy && (
          <p className="text-xs text-destructive">{form.formState.errors.privacy.message}</p>
        )}
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
              className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                form.watch("location_type") === "address"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground"
              }`}
            >
              {form.watch("location_type") === "address" && (
                <Check className="h-4 w-4 shrink-0" />
              )}
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
              className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                form.watch("location_type") === "online"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground"
              }`}
            >
              {form.watch("location_type") === "online" && (
                <Check className="h-4 w-4 shrink-0" />
              )}
              {t("eventForm.locationTypeOnline")}
            </span>
          </label>
        </div>
        {form.watch("location_type") === "online" && (
          <div className="pt-2">
            <Label htmlFor="meeting_url">{t("eventForm.meetingLinkLabel")}</Label>
            <Input
              id="meeting_url"
              type="url"
              {...form.register("meeting_url")}
              placeholder={t("eventForm.meetingLinkPlaceholder")}
            />
            {form.formState.errors.meeting_url && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.meeting_url.message}
              </p>
            )}
          </div>
        )}
        {form.watch("location_type") === "address" && (
          <div className="pt-2">
            <Label htmlFor="address">{t("eventForm.addressPlaceholder")}</Label>
            <Input
              id="address"
              {...form.register("address")}
              placeholder={t("eventForm.addressPlaceholder")}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("eventForm.addressHint")}
            </p>
            {form.formState.errors.address && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.address.message}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="attendee_limit">{t("eventForm.attendeeLimit")}</Label>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="cursor-pointer">
            <input
              type="radio"
              checked={
                form.watch("attendee_limit") === "" ||
                form.watch("attendee_limit") === undefined
              }
              onChange={() => form.setValue("attendee_limit", "")}
              className="sr-only"
            />
            <span
              className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                form.watch("attendee_limit") === "" ||
                form.watch("attendee_limit") === undefined
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground"
              }`}
            >
              {(form.watch("attendee_limit") === "" ||
                form.watch("attendee_limit") === undefined) && (
                <Check className="h-4 w-4 shrink-0" />
              )}
              {t("eventForm.noLimit")}
            </span>
          </label>
          <label className="cursor-pointer inline-flex items-center gap-2">
            <input
              type="radio"
              checked={
                form.watch("attendee_limit") !== "" &&
                form.watch("attendee_limit") !== undefined
              }
              onChange={() => form.setValue("attendee_limit", "50")}
              className="sr-only"
            />
            <span
              className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                form.watch("attendee_limit") !== "" &&
                form.watch("attendee_limit") !== undefined
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground"
              }`}
            >
              {form.watch("attendee_limit") !== "" &&
                form.watch("attendee_limit") !== undefined && (
                  <Check className="h-4 w-4 shrink-0" />
                )}
              {t("eventForm.limitTo")}
            </span>
          </label>
          {(form.watch("attendee_limit") !== "" &&
            form.watch("attendee_limit") !== undefined) && (
            <>
              <Input
                id="attendee_limit"
                type="number"
                min={1}
                className="w-24"
                value={
                  (() => {
                    const v = form.watch("attendee_limit");
                    if (v === "" || v === undefined) return "";
                    return typeof v === "number" ? String(v) : v;
                  })()
                }
                onChange={(e) => {
                  const v = e.target.value;
                  form.setValue("attendee_limit", v === "" ? "" : v);
                }}
              />
              <span className="text-sm text-muted-foreground">{t("eventForm.attendees")}</span>
            </>
          )}
        </div>
        {form.formState.errors.attendee_limit && (
          <p className="text-xs text-destructive">
            {form.formState.errors.attendee_limit.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="event_description">{t("eventForm.introduceEvent")}</Label>
        <textarea
          id="event_description"
          {...form.register("description")}
          rows={4}
          className="textarea-rounded-box"
          placeholder={t("eventForm.descriptionPlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("eventForm.uploadCover")}</Label>
        <Input
          type="file"
          accept=".jpg,.jpeg,.png,.gif"
          onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          {t("eventForm.coverHint")}
        </p>
        {bannerFile && validateCoverFile(bannerFile) && (
          <p className="text-xs text-destructive">{validateCoverFile(bannerFile)}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="outline" asChild>
          <Link href={cancelHref}>{cancelLabel}</Link>
        </Button>
        <Button type="submit" disabled={submitting} form="event-form">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
