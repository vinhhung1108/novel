"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

/* ------------------------------------------------
 * Types & Context
 * ----------------------------------------------*/
type Item = { value: string; label: string };

type Ctx = {
  value?: string;
  // Rename để tránh cảnh báo Server Action
  onValueChangeAction?: (val: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  // useRef(null) -> MutableRefObject<HTMLButtonElement | null>
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
};

const SelectCtx = React.createContext<Ctx | null>(null);

export function Select({
  value,
  onValueChangeAction,
  children,
}: {
  value?: string;
  onValueChangeAction?: (val: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Item[]>([]);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const ctx: Ctx = {
    value,
    onValueChangeAction,
    open,
    setOpen,
    items,
    setItems,
    triggerRef,
  };

  return <SelectCtx.Provider value={ctx}>{children}</SelectCtx.Provider>;
}

/* ------------------------------------------------
 * Trigger
 * ----------------------------------------------*/
export function SelectTrigger({
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(SelectCtx)!;
  return (
    <button
      type="button"
      ref={ctx.triggerRef}
      aria-haspopup="listbox"
      aria-expanded={ctx.open}
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn(
        "inline-flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
      {...rest}
    >
      <span className="truncate">{children}</span>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="ml-2 h-4 w-4 opacity-70"
        fill="currentColor"
      >
        <path d="M5.5 7.5l4.5 4.5 4.5-4.5h-9z" />
      </svg>
    </button>
  );
}

/* ------------------------------------------------
 * Value (placeholder / selected text)
 * ----------------------------------------------*/
export function SelectValue({
  placeholder,
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const ctx = React.useContext(SelectCtx)!;
  const label =
    ctx.items.find((i) => i.value === ctx.value)?.label ?? placeholder ?? "";

  return (
    <span
      className={cn(
        "truncate text-left",
        !ctx.value && "text-muted-foreground",
        className
      )}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------
 * Content (portal + click outside + Escape)
 * ----------------------------------------------*/
export function SelectContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(SelectCtx)!;
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setContainer(document.body), []);

  React.useEffect(() => {
    if (!ctx.open) return;
    const onDown = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        ctx.triggerRef.current &&
        !ctx.triggerRef.current.contains(e.target as Node)
      ) {
        ctx.setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ctx.open, ctx.triggerRef, ctx.setOpen]);

  if (!ctx.open || !container) return null;

  const rect = ctx.triggerRef.current?.getBoundingClientRect();
  const style: React.CSSProperties = rect
    ? {
        position: "fixed",
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        zIndex: 50,
      }
    : {};

  const content = (
    <div
      ref={panelRef}
      role="listbox"
      aria-activedescendant={ctx.value}
      className={cn(
        "max-h-72 overflow-auto rounded-md border bg-popover p-1 shadow-md",
        className
      )}
      style={style}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          ctx.setOpen(false);
          ctx.triggerRef.current?.focus();
        }
      }}
    >
      {children}
    </div>
  );

  return createPortal(content, container);
}

/* ------------------------------------------------
 * Item
 * ----------------------------------------------*/
export function SelectItem({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(SelectCtx)!;

  // đăng ký label cho SelectValue
  React.useEffect(() => {
    // delay 1 tick để chắc chắn children đã render
    const t = setTimeout(() => {
      ctx.setItems((prev) => {
        if (prev.some((i) => i.value === value)) return prev;
        const label =
          typeof children === "string" ? children : (value as string);
        return [...prev, { value, label }];
      });
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const selected = ctx.value === value;

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => {
        ctx.onValueChangeAction?.(value);
        ctx.setOpen(false);
        ctx.triggerRef.current?.focus();
      }}
      className={cn(
        "flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-2 text-left text-sm",
        selected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}
