"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** MM-DD-YYYY: typing digits auto-inserts dashes. */
export function DateMaskedInput({
  value,
  onChange,
  id,
  className,
  placeholder = "MM-DD-YYYY",
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const digitsOnly = value.replace(/\D/g, "");
  const display = formatDateDigits(digitsOnly);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    onChange(formatDateDigits(raw));
  }

  return (
    <Input
      {...props}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={display}
      onChange={handleChange}
      className={cn("font-mono tabular-nums", className)}
    />
  );
}

function formatDateDigits(digits: string): string {
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
}

/** Parse MM-DD-YYYY to YYYY-MM-DD for Date. */
export function parseDateMDY(mdy: string): string | null {
  const d = mdy.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const mm = d.slice(0, 2);
  const dd = d.slice(2, 4);
  const yyyy = d.slice(4, 8);
  const m = parseInt(mm, 10);
  const day = parseInt(dd, 10);
  const y = parseInt(yyyy, 10);
  if (m < 1 || m > 12 || day < 1 || day > 31 || y < 1900 || y > 2100) return null;
  return `${yyyy}-${mm}-${dd}`;
}
