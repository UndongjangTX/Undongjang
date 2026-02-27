"use client";

import * as React from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";

/** Date-only picker with same design as DateTimePicker (calendar popover, no time). Uses DatePicker under the hood. */
export interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

const DateInput = React.forwardRef<unknown, DateInputProps>(
  ({ className, id, value, onChange, placeholder, disabled, "aria-label": ariaLabel }, _ref) => {
    return (
      <DatePicker
        id={id}
        value={value}
        onChange={onChange}
        className={cn(className)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
      />
    );
  }
);
DateInput.displayName = "DateInput";

export { DateInput };
