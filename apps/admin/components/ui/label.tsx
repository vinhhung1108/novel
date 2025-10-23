import * as React from "react";
import { cn } from "./cn";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}
export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn("mb-1 block text-sm font-medium text-gray-700", className)}
      {...props}
    />
  );
}
