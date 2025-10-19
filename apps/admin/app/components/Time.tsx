"use client";

import { useMemo } from "react";

export type TimeProps = {
  /** ISO string / Date / null */
  value?: string | Date | null;
  /** Mặc định: dd/MM/yyyy (sẽ tự thêm HH:mm nếu withTime=true) */
  fmt?: string;
  /** Nếu true sẽ thêm giờ/phút (HH:mm) */
  withTime?: boolean;
  /** Text hiển thị khi không có giá trị hợp lệ */
  fallback?: string;
};

function isValidDate(d: Date) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Định dạng ngày theo fmt đơn giản: dd/MM/yyyy và HH:mm */
function formatDate(d: Date, fmt: string) {
  const DD = pad(d.getDate());
  const MM = pad(d.getMonth() + 1);
  const YYYY = d.getFullYear();
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());

  return fmt
    .replace(/dd/g, DD)
    .replace(/MM/g, MM)
    .replace(/yyyy/g, String(YYYY))
    .replace(/HH/g, HH)
    .replace(/mm/g, mm);
}

export default function Time({
  value,
  fmt = "dd/MM/yyyy",
  withTime,
  fallback = "—",
}: TimeProps) {
  const text = useMemo(() => {
    if (!value) return fallback;
    const d = value instanceof Date ? value : new Date(value);
    if (!isValidDate(d)) return fallback;

    const fmtFinal = withTime ? `${fmt} HH:mm` : fmt;
    return formatDate(d, fmtFinal);
  }, [value, fmt, withTime, fallback]);

  return <time>{text}</time>;
}
