"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "./components/AuthProvider";
import Time from "./components/Time";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
const CDN =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ?? "http://localhost:9000/novels";

type Counts = { novels: number; chapters: number; authors: number; tags: number };
type SeriesItem = { date: string; views: number };
type TopItem = {
  novel: {
    id: string;
    title: string;
    slug: string;
    description?: string | null;
    cover_image_key?: string | null;
    updated_at: string;
  };
  views: number;
};

// formatter dd/MM/yyyy
function formatDMY(input: string | number | Date): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function AdminHome() {
  const { logout } = useAuth();

  const [counts, setCounts] = useState<Counts | null>(null);
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [top, setTop] = useState<TopItem[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        const [cRes, sRes, tRes] = await Promise.all([
          fetch(`${API}/v1/stats`, { cache: "no-store" }),
          fetch(`${API}/v1/stats/series?granularity=day&range=7`, {
            cache: "no-store",
          }),
          fetch(`${API}/v1/stats/top?days=7&limit=10`, { cache: "no-store" }),
        ]);
        const c = await cRes.json();
        const s = await sRes.json();
        const t = await tRes.json();

        setCounts(c);
        setSeries(s?.items ?? []);
        setTop(t?.items ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Không tải được dashboard");
      }
    })();
  }, []);

  const chartData = useMemo(
    () =>
      (series ?? []).map((x) => ({
        d: new Date(x.date).toISOString(), // giữ ISO để tooltip chính xác
        views: x.views,
      })),
    [series]
  );

  return (
    <main style={{ padding: 24, display: "grid", gap: 24 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <h1 style={{ margin: 0 }}>Bảng điều khiển</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/novels"
            style={{
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              color: "#111",
            }}
          >
            ➕ Tạo truyện
          </Link>
          <button
            onClick={logout}
            style={{ padding: "8px 12px", borderRadius: 8 }}
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {err && (
        <div style={{ color: "crimson", fontWeight: 600 }}>
          Lỗi dashboard: {err}
        </div>
      )}

      {/* Thống kê tổng */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
          gap: 12,
        }}
      >
        {[
          { label: "Truyện", value: counts?.novels ?? 0 },
          { label: "Chương", value: counts?.chapters ?? 0 },
          { label: "Tác giả", value: counts?.authors ?? 0 },
          { label: "Tag", value: counts?.tags ?? 0 },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              padding: 16,
              border: "1px solid #eee",
              borderRadius: 12,
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontSize: 12, color: "#666" }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{c.value}</div>
          </div>
        ))}
      </section>

      {/* Chart views 7 ngày */}
      <section
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>Lượt xem 7 ngày gần nhất</div>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="d"
                tickFormatter={(v: string) => formatDMY(v)} // ⬅️ Trả string
                interval="preserveStartEnd"
              />
              <YAxis allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0];
                  return (
                    <div
                      style={{
                        background: "white",
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        padding: 8,
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <b>
                          <Time value={label as string} fmt="dmy" />
                        </b>
                      </div>
                      <div>Views: {item.value as number}</div>
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="views" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Top truyện 7 ngày */}
      <section
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 600, display: "flex", gap: 8 }}>
          Top truyện theo lượt xem (7 ngày)
          <Link
            href="/novels/list"
            style={{ marginLeft: "auto", fontSize: 13 }}
          >
            Xem danh sách truyện →
          </Link>
        </div>

        {top.length === 0 ? (
          <div style={{ color: "#666" }}>Chưa có dữ liệu.</div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "1fr",
            }}
          >
            {top.map((t, i) => (
              <div
                key={t.novel.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "64px 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: 8,
                  border: "1px solid #f0f0f0",
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    overflow: "hidden",
                    borderRadius: 8,
                    background: "#f5f5f5",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    color: "#888",
                  }}
                >
                  {t.novel.cover_image_key ? (
                    <img
                      src={`${CDN}/${t.novel.cover_image_key}`}
                      alt={t.novel.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    <span>#{i + 1}</span>
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                    title={t.novel.title}
                  >
                    {i + 1}. {t.novel.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    /{t.novel.slug} • Cập nhật:{" "}
                    <Time value={t.novel.updated_at} fmt="dmy" />
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                    <Link
                      href={`/novels/${encodeURIComponent(
                        t.novel.slug
                      )}/chapters`}
                      style={{ fontSize: 13 }}
                    >
                      📚 Quản lý chương
                    </Link>
                    <a
                      href={`http://localhost:3000/truyen/${encodeURIComponent(
                        t.novel.slug
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13 }}
                    >
                      👁️ Xem
                    </a>
                  </div>
                </div>

                <div style={{ textAlign: "right", fontWeight: 700 }}>
                  {t.views.toLocaleString("vi-VN")} views
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
