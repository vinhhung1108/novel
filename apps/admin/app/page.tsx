"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Time from "@/components/Time";
import { useAuth } from "@/components/AuthProvider";
import {
  fetchOverview,
  fetchSeries,
  fetchTop,
  type Overview,
  type SeriesItem,
  type TopItem,
} from "@/app/lib/stats";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
const CDN =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ?? "http://localhost:9000/novels";

type SeriesResp = { items: SeriesItem[] };
type TopResp = { items: TopItem[] };

export default function AdminDashboardPage() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [ov, setOv] = useState<Overview>({
    novels: 0,
    chapters: 0,
    authors: 0,
    tags: 0,
  });
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [top, setTop] = useState<TopItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");

        const [ovj, ser, top10] = await Promise.all([
          fetchOverview(), // có thể trả null nếu 404
          fetchSeries(7, "day"), // có thể trả null nếu 404
          fetchTop(7, 10), // có thể trả null nếu 404
        ]);

        if (ovj) setOv(ovj);
        else setErr((e) => e || "Stats module chưa bật (404)");

        if (ser) setSeries(ser);
        if (top10) setTop(top10);
      } catch (e: any) {
        setErr(e?.message ?? "Lỗi tải dữ liệu");
        setSeries([]);
        setTop([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalViews7d = useMemo(
    () => series.reduce((sum, it) => sum + (it?.views ?? 0), 0),
    [series]
  );

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Bảng điều khiển</h1>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/novels"
            className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            ➕ Tạo truyện
          </Link>
          <Link
            href="/novels/list"
            className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Danh sách truyện →
          </Link>
        </div>
      </div>

      {/* Tổng quan */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Truyện" value={ov.novels} />
        <StatCard label="Chương" value={ov.chapters} />
        <StatCard label="Tác giả" value={ov.authors} />
        <StatCard label="Tag" value={ov.tags} />
      </section>

      {/* Views 7 ngày + Top */}
      <section className="grid md:grid-cols-2 gap-6">
        {/* Views 7 ngày */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Lượt xem 7 ngày gần nhất</h2>
            <div className="text-sm text-gray-500">
              Tổng: <b>{totalViews7d}</b>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-500 text-sm">Đang tải…</div>
          ) : err ? (
            <div className="text-red-600 text-sm">{err}</div>
          ) : series.length === 0 ? (
            <div className="text-gray-600 text-sm">Chưa có dữ liệu.</div>
          ) : (
            <>
              <BarsChart data={series} />
              <ul className="mt-3 grid gap-1 text-sm text-gray-600">
                {series.map((d) => (
                  <li key={d.date} className="flex justify-between">
                    <span>
                      <Time value={d.date} />
                    </span>
                    <span className="tabular-nums">{d.views}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Top 7 ngày */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Top truyện theo lượt xem (7 ngày)</h2>
            <Link
              href="/novels/list"
              className="text-sm text-gray-600 hover:underline"
            >
              Xem danh sách →
            </Link>
          </div>
          {loading ? (
            <div className="text-gray-500 text-sm">Đang tải…</div>
          ) : err ? (
            <div className="text-red-600 text-sm">{err}</div>
          ) : top.length === 0 ? (
            <div className="text-gray-600 text-sm">Chưa có dữ liệu.</div>
          ) : (
            <div className="grid gap-3">
              {top.map((t) => (
                <div
                  key={t.novel.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="w-14 h-18 shrink-0 bg-gray-100 rounded overflow-hidden">
                    {t.novel.cover_image_key ? (
                      <img
                        src={`${CDN}/${t.novel.cover_image_key}`}
                        alt={t.novel.title}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{t.novel.title}</div>
                    <div className="text-xs text-gray-500">
                      Cập nhật: <Time value={t.novel.updated_at} withTime />
                    </div>
                  </div>
                  <div className="text-sm tabular-nums">{t.views} lượt</div>
                  <Link
                    href={`/novels/${encodeURIComponent(
                      t.novel.slug
                    )}/chapters`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Quản lý →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/** Thẻ số liệu */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-gray-500 text-sm">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

/** Mini bar chart bằng SVG thuần, tránh phụ thuộc lib ngoài */
function BarsChart({ data }: { data: SeriesItem[] }) {
  const values = data.map((d) => d.views);
  const max = Math.max(1, ...values);
  const W = 520; // chiều rộng tổng thể
  const H = 120; // chiều cao tổng thể
  const pad = 10;
  const barGap = 8;
  const n = data.length;
  const barW = Math.max(8, Math.floor((W - pad * 2 - barGap * (n - 1)) / n));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-[140px] bg-[linear-gradient(#f8fafc,#ffffff)] rounded-lg border border-gray-100"
      role="img"
      aria-label="Biểu đồ lượt xem 7 ngày"
    >
      {/* Trục đáy mờ */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#e5e7eb" />
      {data.map((d, i) => {
        const h = Math.round(((d.views || 0) / max) * (H - pad * 2));
        const x = pad + i * (barW + barGap);
        const y = H - pad - h;
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={4}
              className="fill-gray-700/70 hover:fill-gray-900 transition-colors"
            />
            {/* Nhãn giá trị nhỏ phía trên cột */}
            {h > 14 && (
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize="10"
                fill="#374151"
              >
                {d.views}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
