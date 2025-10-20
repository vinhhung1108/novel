"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { OverviewCards } from "@/components/dashboard/OverviewCards";
import { ViewsChart } from "@/components/dashboard/ViewsChart";
import { TopNovelsCard } from "@/components/dashboard/TopNovelsCard";
import { useDashboardData } from "@/hooks/useDashboardData";
import { SkeletonBlock } from "@/components/dashboard/SkeletonBlock";
import { ErrorState } from "@/components/dashboard/ErrorState";

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const { loading, error, overview, series, top } = useDashboardData({ token });

  const totalViews7d = useMemo(() => {
    if (!series || series.length === 0) return 0;
    return series.reduce((sum, item) => sum + (item?.views ?? 0), 0);
  }, [series]);

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-6 pb-12 pt-6">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Chào mừng trở lại
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Bảng điều khiển
          </h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link
            href="/novels/new"
            className="inline-flex items-center rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
          >
            ➕ Thêm truyện mới
          </Link>
          <Link
            href="/novels/list"
            className="inline-flex items-center rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
          >
            📚 Quản lý truyện
          </Link>
        </div>
      </header>

      {error && !loading ? (
        <ErrorState message={error} />
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <SkeletonBlock rows={2} repeat={4} />
        ) : (
          <OverviewCards data={overview} />
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                Lượt xem 7 ngày gần nhất
              </h2>
              <p className="text-sm text-zinc-500">
                Tổng cộng: <span className="font-semibold">{totalViews7d}</span>
              </p>
            </div>
            <Link
              href="/stats"
              className="ml-auto text-sm font-medium text-zinc-600 transition hover:text-zinc-800"
            >
              Xem thống kê chi tiết →
            </Link>
          </div>

          <div className="mt-6 min-h-[240px]">
            {loading ? (
              <SkeletonBlock rows={6} repeat={1} height="h-40" />
            ) : series && series.length ? (
              <ViewsChart data={series} />
            ) : (
              <div className="grid h-full place-items-center text-sm text-zinc-500">
                Chưa có dữ liệu.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                Top truyện (7 ngày)
              </h2>
              <p className="text-sm text-zinc-500">
                Dựa trên lượt xem mới nhất
              </p>
            </div>
          </div>

          <div className="mt-6 min-h-[240px]">
            {loading ? (
              <SkeletonBlock rows={5} repeat={1} height="h-12" />
            ) : top && top.length ? (
              <TopNovelsCard novels={top} />
            ) : (
              <div className="grid h-full place-items-center text-sm text-zinc-500">
                Chưa có dữ liệu.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
