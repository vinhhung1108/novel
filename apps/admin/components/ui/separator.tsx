"use client";

import * as React from "react";
import { cn } from "./cn";

export function Separator({
  orientation = "horizontal",
  decorative = true,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
  /** nếu để true, sẽ dùng role="none" cho mục đích thuần trang trí */
  decorative?: boolean;
}) {
  const isHorizontal = orientation === "horizontal";
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        isHorizontal ? "my-2 h-px w-full" : "mx-2 h-full w-px",
        className
      )}
      {...rest}
    />
  );
}
