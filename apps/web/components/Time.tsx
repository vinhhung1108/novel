"use client";

import { isoToDMY, isoToDMYHM, ymdToDMY } from "@novels/shared";

type Props = {
  value: string | null | undefined;
  withTime?: boolean;
  source?: "ymd" | "iso";
  className?: string;
};

export default function Time({
  value,
  withTime = false,
  source = "iso",
  className,
}: Props) {
  if (!value) return <span className={className}>—</span>;
  const text =
    source === "ymd"
      ? ymdToDMY(value)
      : withTime
        ? isoToDMYHM(value)
        : isoToDMY(value);
  return (
    <time dateTime={value} title={value} className={className}>
      {text}
    </time>
  );
}
