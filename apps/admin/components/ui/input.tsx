"use client";
import * as React from "react";
import { cn } from "./cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
