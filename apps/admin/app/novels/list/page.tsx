"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import Time from "@/components/Time";

type Novel = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  cover_image_key?: string | null;
  status?: string;
  words_count?: string;
  views?: string;
  updated_at: string;
};

type ListResp = {
  items: Novel[];
  total: number;
  page: number;
  limit: number;
};

const CDN =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ?? "http://localhost:9000/novels";
const DEFAULT_LIMIT = 12;

export default function NovelsListPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { token, getAuthHeader } = useAuth();

  // state từ query
  const [q, setQ] = useState<string>(sp.get("q") || "");
  const [page, setPage] = useState<number>(Number(sp.get("page") || 1));
  const [limit, setLimit] = useState<number>(
    Number(sp.get("limit") || DEFAULT_LIMIT)
  );
  const [sort, setSort] = useState<"updated_at" | "title">(
    (sp.get("sort") as any) || "updated_at"
  );
  const [order, setOrder] = useState<"ASC" | "DESC">(
    ((sp.get("order") || "DESC").toUpperCase() as any) || "DESC"
  );

  // dữ liệu
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState<Novel[]>([]);
  const [total, setTotal] = useState(0);

  // bảo vệ login
  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  // đồng bộ URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("sort", sort);
    params.set("order", order);
    router.replace(`/novels/list?${params.toString()}`);
  }, [q, page, limit, sort, order, router]);

  // debounce q
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  // fetch list
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");

        const url = new URL(apiUrl("/novels"));
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("sort", sort);
        url.searchParams.set("order", order);
        if (debouncedQ.trim()) url.searchParams.set("q", debouncedQ.trim());

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
          setErr(`Không tải được danh sách truyện (${res.status})`);
          setItems([]);
          setTotal(0);
          return;
        }
        const data = (await res.json()) as ListResp;
        setItems(Array.isArray((data as any).items) ? data.items : []);
        setTotal(Number((data as any).total ?? 0));
      } catch (e: any) {
        setErr(e?.message ?? "Lỗi kết nối");
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [page, limit, sort, order, debouncedQ]);

  // tính trang
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / (limit || DEFAULT_LIMIT))),
    [total, limit]
  );

  // đảm bảo page hợp lệ khi totalPages thay đổi
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  // đổi filter → quay về trang 1
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, limit, sort, order]);

  const gotoFirst = () => setPage(1);
  const prev = () => setPage((p) => Math.max(1, p - 1));
  const next = () => setPage((p) => Math.min(totalPages, p + 1));
  const gotoLast = () => setPage(totalPages);

  // xoá 1 truyện
  async function removeNovel(n: Novel) {
    if (!token) return;
    const ok = window.confirm(
      `Xoá truyện "${n.title}"?\nHành động này không thể hoàn tác!`
    );
    if (!ok) return;

    try {
      const res = await fetch(apiUrl(`/novels/${encodeURIComponent(n.id)}`), {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) {
        const t = await res.text();
        alert(`Xoá thất bại: ${res.status} ${t}`);
        return;
      }
      // reload trang hiện tại
      const url = new URL(apiUrl("/novels"));
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("sort", sort);
      url.searchParams.set("order", order);
      if (debouncedQ.trim()) url.searchParams.set("q", debouncedQ.trim());
      const r = await fetch(url.toString(), { cache: "no-store" });
      const data = (await r.json()) as ListResp;
      setItems(data.items);
      setTotal(data.total);
    } catch (e: any) {
      alert(e?.message ?? "Lỗi kết nối");
    }
  }

  return (
    <main className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Danh sách truyện</h1>
        <Link
          href="/novels/new"
          className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
        >
          ➕ Thêm truyện mới
        </Link>
      </div>

      {/* Bộ lọc */}
      <section className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center bg-white border border-gray-200 rounded-xl p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tiêu đề hoặc slug…"
          className="border rounded-lg px-3 py-2 min-w-60"
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Sort</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="border rounded-lg px-2 py-1"
          >
            <option value="updated_at">Cập nhật</option>
            <option value="title">Tiêu đề</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Order</label>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as any)}
            className="border rounded-lg px-2 py-1"
          >
            <option value="DESC">↓ Desc</option>
            <option value="ASC">↑ Asc</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Limit</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border rounded-lg px-2 py-1"
          >
            {[12, 24, 36, 48, 60, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="text-right text-sm text-gray-600">
          {loading
            ? "Đang tải…"
            : `Tổng: ${total} • Trang ${page}/${totalPages}`}
        </div>
      </section>

      {/* Grid items */}
      <section>
        {loading ? (
          <div>Đang tải…</div>
        ) : err ? (
          <div className="text-red-600">{err}</div>
        ) : items.length === 0 ? (
          <div>Không có truyện nào.</div>
        ) : (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {items.map((n) => (
              <div
                key={n.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                <div className="w-full aspect-[3/4] bg-gray-100">
                  {n.cover_image_key ? (
                    <img
                      src={`${CDN}/${n.cover_image_key}`}
                      alt={n.title}
                      className="w-full h-full object-cover block"
                    />
                  ) : null}
                </div>
                <div className="p-3 grid gap-2">
                  <div className="font-medium leading-tight line-clamp-2">
                    {n.title}
                  </div>
                  <div className="text-xs text-gray-600 break-all">
                    /{n.slug}
                  </div>
                  <div className="text-xs text-gray-600">
                    Cập nhật: <Time value={n.updated_at} withTime />
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Link
                      href={`/novels/edit/${encodeURIComponent(n.slug)}`}
                      className="text-sm hover:underline"
                    >
                      ✏️ Sửa
                    </Link>
                    <Link
                      href={`/novels/${encodeURIComponent(n.slug)}/chapters`}
                      className="text-sm hover:underline"
                    >
                      📚 Chương
                    </Link>
                    <a
                      href={`http://localhost:3000/truyen/${encodeURIComponent(n.slug)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm hover:underline"
                    >
                      👁️ Xem web
                    </a>
                    <button
                      onClick={() => removeNovel(n)}
                      className="text-sm text-red-600 hover:underline ml-auto"
                    >
                      🗑️ Xoá
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pagination */}
      <section className="flex items-center gap-2 justify-center">
        <button
          onClick={gotoFirst}
          disabled={page <= 1}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          « Đầu
        </button>
        <button
          onClick={prev}
          disabled={page <= 1}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          ← Trước
        </button>
        <span className="px-2">
          Trang {page} / {totalPages}
        </span>
        <button
          onClick={next}
          disabled={page >= totalPages}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          Sau →
        </button>
        <button
          onClick={gotoLast}
          disabled={page >= totalPages}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          Cuối »
        </button>
      </section>
    </main>
  );
}
