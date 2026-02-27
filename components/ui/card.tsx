import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardCover = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative w-full aspect-[2.35/1] bg-muted overflow-hidden rounded-t-xl",
      className
    )}
    {...props}
  />
));
CardCover.displayName = "CardCover";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4", className)} {...props} />
));
CardContent.displayName = "CardContent";

export { Card, CardCover, CardContent };
