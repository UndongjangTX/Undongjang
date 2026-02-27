"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { format, setHours, setMinutes, isValid } from "date-fns";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

/** Value in datetime-local format: YYYY-MM-DDTHH:mm */
export interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

function parseValue(value: string): Date | null {
  if (!value?.trim()) return null;
  try {
    const d = new Date(value);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

function toDateTimeLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function DateTimePicker({
  value,
  onChange,
  id,
  className,
  placeholder = "mm/dd/yyyy, --:-- --",
  disabled,
  "aria-label": ariaLabel,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const parsed = parseValue(value);
  const [month, setMonth] = React.useState<Date>(() => parsed ?? new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(parsed ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) : null);
  const hour12 = parsed ? (parsed.getHours() % 12 || 12) : 12;
  const [hour, setHour] = React.useState<number>(hour12);
  const [minute, setMinute] = React.useState<number>(parsed ? parsed.getMinutes() : 0);
  const [ampm, setAmPm] = React.useState<"AM" | "PM">(parsed && parsed.getHours() >= 12 ? "PM" : "AM");

  React.useEffect(() => {
    const p = parseValue(value);
    if (p) {
      setSelectedDate(new Date(p.getFullYear(), p.getMonth(), p.getDate()));
      setHour(p.getHours() % 12 || 12);
      setMinute(p.getMinutes());
      setAmPm(p.getHours() >= 12 ? "PM" : "AM");
    }
  }, [value]);

  React.useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  function applySelection() {
    if (!selectedDate) return;
    let h24 = hour;
    if (ampm === "PM" && h24 !== 12) h24 += 12;
    if (ampm === "AM" && h24 === 12) h24 = 0;
    const d = setMinutes(setHours(selectedDate, h24), minute);
    onChange(toDateTimeLocal(d));
    setOpen(false);
  }

  function onDaySelect(d: Date | undefined) {
    if (!d) return;
    setSelectedDate(d);
    setMonth(d);
  }

  const displayText = parsed
    ? format(parsed, "MM/dd/yyyy, hh:mm a")
    : "";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-full border border-primary-green bg-transparent px-4 py-1 text-left text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-green disabled:cursor-not-allowed disabled:opacity-50",
          !displayText && "text-muted-foreground"
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-primary-green" />
        <span className="min-w-0 flex-1 truncate">{displayText || placeholder}</span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 flex flex-col gap-3 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
          role="dialog"
          aria-label="Choose date and time"
        >
          <DayPicker
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={onDaySelect}
            month={month}
            onMonthChange={setMonth}
            classNames={{
              root: "mx-auto",
              months: "flex flex-col",
              month: "space-y-3",
              caption: "flex flex-row justify-between items-center w-full px-1 text-sm font-semibold text-foreground",
              caption_label: "flex-1",
              nav: "flex flex-row gap-1 items-center shrink-0",
              nav_button: "inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent",
              nav_button_previous: "inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent",
              nav_button_next: "inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent",
              head_row: "flex",
              head_cell: "w-9 rounded-md text-center text-xs font-medium text-muted-foreground",
              row: "flex w-full mt-1",
              cell: "h-9 w-9 p-0",
              day: cn(
                "h-9 w-9 rounded-full text-sm font-medium transition-colors",
                "hover:bg-primary-green/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-green focus-visible:ring-offset-2"
              ),
              day_selected: "bg-primary-green text-white hover:bg-primary-green hover:text-white",
              day_today: "font-semibold text-primary-green",
              day_outside: "text-muted-foreground opacity-50",
              day_hidden: "invisible",
            }}
          />
          <div className="border-t pt-3 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground shrink-0">Time</span>
            <div className="flex items-center gap-1.5 h-8">
              <select
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="h-8 w-11 appearance-none rounded-full border border-input bg-background px-2 text-center text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-green"
                aria-label="Hour"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground text-sm">:</span>
              <select
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value))}
                className="h-8 w-11 appearance-none rounded-full border border-input bg-background px-2 text-center text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-green"
                aria-label="Minute"
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <div className="flex h-8 rounded-full border border-input bg-background p-0.5 items-center">
                {(["AM", "PM"] as const).map((ap) => (
                  <button
                    key={ap}
                    type="button"
                    onClick={() => setAmPm(ap)}
                    className={cn(
                      "h-full rounded-full px-2.5 text-sm font-medium transition-colors flex items-center justify-center min-w-[2.25rem]",
                      ampm === ap
                        ? "bg-primary-green text-white"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {ap}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applySelection}
              disabled={!selectedDate}
              className="rounded-full bg-primary-green px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-green/90 disabled:opacity-50"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
