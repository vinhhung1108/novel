"use client";
import * as React from "react";
import { cn } from "./cn";
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
