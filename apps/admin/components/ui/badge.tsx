import * as React from "react";
import { cn } from "./cn";

const variants = {
  default:
    "bg-primary text-primary-foreground border-transparent hover:bg-primary/90",
  secondary:
    "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80",
  outline:
    "border border-input bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
};

export type BadgeVariant = keyof typeof variants;

export function Badge({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: BadgeVariant;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
