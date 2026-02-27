"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Optional extra class on the wrapper (inner select gets base + focus styles). */
  className?: string;
  /** When true, use the green border style (e.g. repeat interval). */
  variant?: "default" | "green";
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div className={cn("relative", className)}>
        <select
          ref={ref}
          className={cn(
            "flex h-9 w-full appearance-none rounded-full pl-4 pr-10 py-1 text-sm transition-colors focus-visible:outline-none [&::-ms-expand]:hidden",
            variant === "green"
              ? "border-2 border-primary-green bg-white focus-visible:ring-2 focus-visible:ring-primary-green"
              : "border border-input bg-transparent focus-visible:ring-1 focus-visible:ring-primary-green"
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-green"
          aria-hidden
        />
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
