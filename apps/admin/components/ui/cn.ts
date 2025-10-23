import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gộp className hợp lệ */
export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}
