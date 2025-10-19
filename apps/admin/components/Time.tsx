// apps/admin/components/Time.tsx
"use client";

export type TimeProps = {
  value?: string | number | Date | null;
  withTime?: boolean;
  className?: string;
};

export default function Time({ value, withTime, className }: TimeProps) {
  if (!value) return <span className={className}>—</span>;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return <span className={className}>—</span>;

  const opts: Intl.DateTimeFormatOptions = withTime
    ? {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    : { year: "numeric", month: "2-digit", day: "2-digit" };

  return (
    <time className={className}>
      {new Intl.DateTimeFormat("vi-VN", opts).format(d)}
    </time>
  );
}
