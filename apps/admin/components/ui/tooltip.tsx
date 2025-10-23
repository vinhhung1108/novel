"use client";

import * as React from "react";
import { cn } from "./cn";

/**
 * Tooltip tối giản theo API shadcn:
 * <TooltipProvider>
 *   <Tooltip>
 *     <TooltipTrigger asChild>...</TooltipTrigger>
 *     <TooltipContent>...</TooltipContent>
 *   </Tooltip>
 * </TooltipProvider>
 *
 * Không phụ thuộc Radix; hoạt động tốt cho hover/focus.
 */

type TooltipContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  id: string;
};

const TooltipCtx = React.createContext<TooltipContextValue | null>(null);

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const ctx = React.useMemo(() => ({ open, setOpen, id }), [open, id]);

  return <TooltipCtx.Provider value={ctx}>{children}</TooltipCtx.Provider>;
}

type TriggerProps = React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean;
};

export function TooltipTrigger({
  asChild,
  children,
  className,
  ...rest
}: TriggerProps) {
  const ctx = React.useContext(TooltipCtx);
  if (!ctx) throw new Error("TooltipTrigger must be used within <Tooltip>");

  const common = {
    onMouseEnter: () => ctx.setOpen(true),
    onMouseLeave: () => ctx.setOpen(false),
    onFocus: () => ctx.setOpen(true),
    onBlur: () => ctx.setOpen(false),
    "aria-describedby": ctx.open ? ctx.id : undefined,
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ...common,
      ...rest,
      className: cn((children as any).props?.className, className),
    });
  }

  return (
    <button
      type="button"
      className={cn("inline-flex items-center", className)}
      {...common}
      {...rest}
    >
      {children}
    </button>
  );
}

type ContentProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
};

export function TooltipContent({
  className,
  children,
  side = "top",
  align = "center",
  ...rest
}: ContentProps) {
  const ctx = React.useContext(TooltipCtx);
  if (!ctx) throw new Error("TooltipContent must be used within <Tooltip>");
  if (!ctx.open) return null;

  // Vị trí cơ bản bằng CSS; yêu cầu wrapper Trigger là inline-block/relative
  const sideClass =
    side === "top"
      ? "bottom-full mb-1 left-1/2 -translate-x-1/2"
      : side === "bottom"
        ? "top-full mt-1 left-1/2 -translate-x-1/2"
        : side === "left"
          ? "right-full mr-2 top-1/2 -translate-y-1/2"
          : "left-full ml-2 top-1/2 -translate-y-1/2";

  const alignClass =
    align === "start"
      ? "justify-start"
      : align === "end"
        ? "justify-end"
        : "justify-center";

  return (
    <div className="relative inline-block">
      <div
        id={ctx.id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50",
          sideClass,
          className
        )}
        {...rest}
      >
        <div
          className={cn(
            "max-w-xs rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-800 shadow-md",
            "flex",
            alignClass
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
