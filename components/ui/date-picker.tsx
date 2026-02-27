"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { format, isValid } from "date-fns";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

/** Value in YYYY-MM-DD format. Same trigger/popover design as DateTimePicker, no time. */
export interface DatePickerProps {
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
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  return isValid(d) ? d : null;
}

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DatePicker({
  value,
  onChange,
  id,
  className,
  placeholder = "Select date",
  disabled,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const parsed = parseValue(value);
  const [month, setMonth] = React.useState<Date>(() => parsed ?? new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(parsed);

  React.useEffect(() => {
    const p = parseValue(value);
    setSelectedDate(p);
    if (p) setMonth(p);
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

  function applySelection() {
    if (!selectedDate) return;
    onChange(toYYYYMMDD(selectedDate));
    setOpen(false);
  }

  function onDaySelect(d: Date | undefined) {
    if (!d) return;
    setSelectedDate(d);
    setMonth(d);
  }

  const displayText = parsed ? format(parsed, "MM/dd/yyyy") : "";

  return (
    <div ref={containerRef} className={cn("relative w-fit", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-auto min-w-[10rem] items-center gap-2 rounded-full border border-input bg-transparent px-4 py-1 text-left text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-green disabled:cursor-not-allowed disabled:opacity-50",
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
          aria-label="Choose date"
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
