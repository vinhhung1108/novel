"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesItem } from "@/app/lib/stats";

const formatter = new Intl.DateTimeFormat("vi-VN", {
  month: "short",
  day: "numeric",
});

export function ViewsChart({ data }: { data: SeriesItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tickFormatter={(value: string) => formatter.format(new Date(value))}
          tick={{ fontSize: 12, fill: "#71717a" }}
        />
        <YAxis
          width={48}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#71717a" }}
        />
        <Tooltip
          cursor={{ fill: "rgba(244, 244, 245, 0.8)" }}
          labelFormatter={(value) => formatter.format(new Date(value))}
        />
        <Bar dataKey="views" radius={[6, 6, 0, 0]} fill="#18181b" />
      </BarChart>
    </ResponsiveContainer>
  );
}
