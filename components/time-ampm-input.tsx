"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Value: 24h "HH:mm" or "". Display: local state until 4 digits then sync. */
export function TimeWithAMPMInput({
  value,
  onChange,
  id,
  className,
  placeholder = "__:__",
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const [displayValue, setDisplayValue] = React.useState("");
  const [ampm, setAmpm] = React.useState<"AM" | "PM">("AM");

  // Sync from parent when value changes (e.g. form reset)
  React.useEffect(() => {
    if (!value || !/^\d{1,2}:\d{2}$/.test(value)) {
      setDisplayValue("");
      setAmpm("AM");
      return;
    }
    const { display12h, ampm: a } = to12h(value);
    setDisplayValue(display12h);
    setAmpm(a);
  }, [value]);

  const displayStr = formatTimeDigits(displayValue.replace(/\D/g, "").slice(0, 4));

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    const formatted = formatTimeDigits(raw);
    setDisplayValue(formatted);
    if (raw.length === 4) {
      const [h, m] = parse12hFormatted(formatted, ampm);
      const [h24] = to24h(h, m, ampm);
      onChange(to24hStr(h24, m));
    } else {
      onChange("");
    }
  }

  function handleAmPm(next: "AM" | "PM") {
    setAmpm(next);
    const raw = displayValue.replace(/\D/g, "").slice(0, 4);
    if (raw.length === 4) {
      const formatted = formatTimeDigits(raw);
      const [h, m] = parse12hFormatted(formatted, next);
      const [h24] = to24h(h, m, next);
      onChange(to24hStr(h24, m));
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        {...props}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={displayStr}
        onChange={handleTimeChange}
        className={cn("font-mono tabular-nums pr-32", props.className)}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0 pointer-events-none" aria-hidden />
        <div className="flex rounded-md border border-input bg-background p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => handleAmPm("AM")}
            className={cn(
              "px-2 py-0.5 text-xs font-medium rounded transition-colors",
              ampm === "AM"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => handleAmPm("PM")}
            className={cn(
              "px-2 py-0.5 text-xs font-medium rounded transition-colors",
              ampm === "PM"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            PM
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTimeDigits(digits: string): string {
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function to12h(value24: string): { display12h: string; ampm: "AM" | "PM" } {
  if (!value24 || !/^\d{1,2}:\d{2}$/.test(value24)) return { display12h: "", ampm: "AM" };
  const [h, m] = value24.split(":").map((n) => parseInt(n, 10));
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const ampm = h < 12 ? "AM" : "PM";
  const display12h = `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return { display12h, ampm };
}

function parse12hFormatted(formatted: string, ampm: "AM" | "PM"): [number, number] {
  if (!formatted || formatted.length < 5) return [12, 0];
  const [hStr, mStr] = formatted.split(":");
  const h = parseInt(hStr || "12", 10) || 12;
  const m = parseInt(mStr || "0", 10) || 0;
  return [Math.min(12, Math.max(1, h)), Math.min(59, Math.max(0, m))];
}

function to24h(h12: number, m: number, ampm: "AM" | "PM"): [number, number] {
  let h24 = h12;
  if (ampm === "AM" && h12 === 12) h24 = 0;
  else if (ampm === "PM" && h12 !== 12) h24 = h12 + 12;
  return [h24, m];
}

function to24hStr(h24: number, m: number): string {
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
