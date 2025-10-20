"use client";
import { clsx } from "@/lib/ui/clsx";

export function MessageBar({ msg }: { msg: string }) {
  if (!msg) return null;
  const isError =
    msg.startsWith("Lỗi") || msg.startsWith("Không") || msg.startsWith("Chưa");
  return (
    <div
      className={clsx(
        "px-3 py-2 rounded-lg text-sm",
        isError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
      )}
    >
      {msg}
    </div>
  );
}
