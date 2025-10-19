"use client";

import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

type SeriesItem = { date: string; views: number };
type SeriesResp = { items: SeriesItem[] };
type TopItem = {
  novel: {
    id: string;
    title: string;
    slug: string;
    cover_image_key?: string | null;
  };
  views: number;
};
type TopResp = { items: TopItem[] };

/** Format 'YYYY-MM-DD' -> 'dd/mm/yyyy' (không phụ thuộc timezone) */
function toDMY(dateStr?: string) {
  if (!dateStr) return "";
  // an toàn: chỉ cắt chuỗi (YYYY-MM-DD)
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function LineChart({
  data,
  width = 720,
  height = 220,
  pad = 24,
  title,
}: {
  data: SeriesItem[];
  width?: number;
  height?: number;
  pad?: number;
  title: string;
}) {
  const points = useMemo(() => {
    if (!data.length) return "";
    const xs = data.map((_, i) => i);
    const ys = data.map((d) => d.views);
    const maxY = Math.max(1, ...ys);
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;
    const p = xs.map((x, i) => {
      const px = pad + (x / Math.max(1, xs.length - 1)) * innerW;
      const py = pad + innerH - (ys[i] / maxY) * innerH;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    });
    return p.join(" ");
  }, [data, width, height, pad]);

  const first = data[0]?.date ?? "";
  const last = data[data.length - 1]?.date ?? "";

  return (
    <svg
      width={width}
      height={height}
      style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12 }}
    >
      {/* grid ngang */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => (
        <line
          key={idx}
          x1={24}
          x2={width - 24}
          y1={24 + (height - 48) * t}
          y2={24 + (height - 48) * t}
          stroke="#f0f0f0"
          strokeWidth={1}
        />
      ))}
      {/* polyline */}
      <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth={2} />
      {/* labels dd/mm/yyyy */}
      <text x={24} y={height - 6} fontSize={11} fill="#666">
        {toDMY(first)}
      </text>
      <text
        x={width - 24}
        y={height - 6}
        fontSize={11}
        fill="#666"
        textAnchor="end"
      >
        {toDMY(last)}
      </text>
      <text x={width / 2} y={16} fontSize={12} fill="#333" textAnchor="middle">
        {title}
      </text>
    </svg>
  );
}

function BarChart({
  data,
  width = 720,
  pad = 24,
  title,
}: {
  data: TopItem[];
  width?: number;
  pad?: number;
  title: string;
}) {
  const barH = 22;
  const gap = 10;
  const maxV = Math.max(1, ...data.map((d) => d.views));
  const innerW = width - pad * 2;
  const height = pad * 2 + data.length * (barH + gap);

  return (
    <svg
      width={width}
      height={height}
      style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12 }}
    >
      {data.map((d, i) => {
        const y = pad + i * (barH + gap);
        const w = (d.views / maxV) * innerW;
        return (
          <g key={d.novel.id}>
            <rect x={pad} y={y} width={innerW} height={barH} fill="#f3f4f6" />
            <rect x={pad} y={y} width={w} height={barH} fill="#10b981" />
            <text x={pad + 6} y={y + barH - 6} fontSize={12} fill="#111">
              {d.novel.title}
            </text>
            <text
              x={width - pad}
              y={y + barH - 6}
              fontSize={12}
              fill="#111"
              textAnchor="end"
            >
              {d.views}
            </text>
          </g>
        );
      })}
      <text x={width / 2} y={16} fontSize={12} fill="#333" textAnchor="middle">
        {title}
      </text>
    </svg>
  );
}

export default function StatsPage() {
  const [daily, setDaily] = useState<SeriesItem[]>([]);
  const [weekly, setWeekly] = useState<SeriesItem[]>([]);
  const [top, setTop] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const [r1, r2, r3] = await Promise.all([
          fetch(`${API}/v1/stats/series?granularity=day&range=14`, {
            cache: "no-store",
          }),
          fetch(`${API}/v1/stats/series?granularity=week&range=12`, {
            cache: "no-store",
          }),
          fetch(`${API}/v1/stats/top?days=7&limit=10`, { cache: "no-store" }),
        ]);
        const j1 = (await r1.json()) as SeriesResp;
        const j2 = (await r2.json()) as SeriesResp;
        const j3 = (await r3.json()) as TopResp;
        setDaily(j1.items ?? []);
        setWeekly(j2.items ?? []);
        setTop((j3.items ?? []).filter((x) => x.novel));
      } catch (e: any) {
        setErr(e?.message ?? "Lỗi tải thống kê");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1>Thống kê</h1>
      {loading ? (
        <div>Đang tải…</div>
      ) : err ? (
        <div style={{ color: "crimson" }}>{err}</div>
      ) : (
        <>
          <section style={{ display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0 }}>Views theo ngày (14 ngày)</h3>
            <LineChart data={daily} title="Views theo ngày" />
            {/* hiển thị nhãn ngày từng điểm (tuỳ chọn) */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                fontSize: 12,
                color: "#555",
              }}
            >
              {daily.map((d) => (
                <span key={d.date}>
                  {toDMY(d.date)}: <b>{d.views}</b>
                </span>
              ))}
            </div>
          </section>

          <section style={{ display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0 }}>Views theo tuần (12 tuần)</h3>
            <LineChart data={weekly} title="Views theo tuần" />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                fontSize: 12,
                color: "#555",
              }}
            >
              {weekly.map((d) => (
                <span key={d.date}>
                  Tuần bắt đầu {toDMY(d.date)}: <b>{d.views}</b>
                </span>
              ))}
            </div>
          </section>

          <section style={{ display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0 }}>Top truyện 7 ngày</h3>
            <BarChart data={top} title="Top truyện 7 ngày (views)" />
          </section>
        </>
      )}
    </main>
  );
}
