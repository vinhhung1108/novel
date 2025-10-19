"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Time from "@/components/Time";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
const CDN =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ?? "http://localhost:9000/novels";

type Novel = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  cover_image_key?: string | null;
  updated_at: string;
};

type ListResp =
  | Novel[]
  | {
      items: Novel[];
      total: number;
      page: number;
      limit: number;
    };

const DEFAULT_LIMIT = 12;

function toArray(resp: ListResp): Novel[] {
  if (Array.isArray(resp)) return resp;
  return resp?.items ?? [];
}

export default function NovelsListPage() {
  const { token, getAuthHeader } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();

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

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState<Novel[]>([]);
  const [total, setTotal] = useState(0);

  // Chưa có token -> quay lại login
  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  // Sync URL
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
  async function fetchList() {
    try {
      setLoading(true);
      setErr("");
      const url = new URL(`${API}/v1/novels`);
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
      } else {
        const data = (await res.json()) as ListResp;
        const arr = toArray(data);
        setItems(arr);
        setTotal(Array.isArray(data) ? arr.length : (data.total ?? arr.length));
      }
    } catch (e: any) {
      setErr(e?.message ?? "Lỗi kết nối");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sort, order, debouncedQ]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / (limit || DEFAULT_LIMIT))),
    [total, limit]
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const gotoFirst = () => setPage(1);
  const prev = () => setPage((p) => Math.max(1, p - 1));
  const next = () => setPage((p) => Math.min(totalPages, p + 1));
  const gotoLast = () => setPage(totalPages);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, limit, sort, order]);

  // Xoá 1 truyện
  const deleteOne = async (id: string, title: string) => {
    if (!confirm(`Xoá truyện “${title}”? Thao tác này không thể hoàn tác.`)) {
      return;
    }
    try {
      const res = await fetch(`${API}/v1/novels/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
      });
      if (!res.ok) {
        const t = await res.text();
        alert(`Xoá thất bại: ${res.status} ${t}`);
        return;
      }
      // refetch danh sách
      await fetchList();
    } catch (e: any) {
      alert(e?.message ?? "Lỗi xoá truyện");
    }
  };

  return (
    <main style={{ display: "grid", gap: 16, padding: 24 }}>
      <h1>Danh sách truyện</h1>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto auto auto",
          gap: 10,
          alignItems: "center",
          border: "1px solid #eee",
          padding: 12,
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tiêu đề hoặc slug…"
          style={{ minWidth: 240 }}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label>Sort</label>
          <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
            <option value="updated_at">Cập nhật</option>
            <option value="title">Tiêu đề</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label>Order</label>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as any)}
          >
            <option value="DESC">↓ Desc</option>
            <option value="ASC">↑ Asc</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label>Limit</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[12, 24, 36, 48, 60, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <Link
          href="/novels"
          style={{
            padding: "8px 12px",
            border: "1px solid #ddd",
            borderRadius: 8,
            textDecoration: "none",
            color: "#111",
            justifySelf: "end",
          }}
        >
          ➕ Thêm truyện
        </Link>
      </section>

      <div style={{ fontSize: 13, color: "#444" }}>
        {loading ? "Đang tải…" : `Tổng: ${total} • Trang ${page}/${totalPages}`}
      </div>

      <section style={{ display: "grid", gap: 14 }}>
        {loading ? (
          <div>Đang tải…</div>
        ) : err ? (
          <div style={{ color: "crimson" }}>{err}</div>
        ) : items.length === 0 ? (
          <div>Không có truyện nào.</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            {items.map((n) => (
              <div
                key={n.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "3/4",
                    background: "#f5f5f5",
                  }}
                >
                  {n.cover_image_key ? (
                    <img
                      src={`${CDN}/${n.cover_image_key}`}
                      alt={n.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : null}
                </div>
                <div style={{ padding: 10, display: "grid", gap: 6 }}>
                  <strong style={{ lineHeight: 1.25 }}>{n.title}</strong>
                  <div style={{ fontSize: 12, color: "#666" }}>/{n.slug}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    Cập nhật: <Time value={n.updated_at} withTime />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      marginTop: 6,
                    }}
                  >
                    <Link
                      href={`/novels/edit/${encodeURIComponent(n.slug)}`}
                      style={{ fontSize: 13 }}
                    >
                      ✏️ Sửa
                    </Link>
                    <Link
                      href={`/novels/${encodeURIComponent(n.slug)}/chapters`}
                      style={{ fontSize: 13 }}
                    >
                      📚 Chương
                    </Link>
                    <a
                      href={`http://localhost:3000/truyen/${encodeURIComponent(
                        n.slug
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13 }}
                    >
                      👁️ Xem web
                    </a>
                    <button
                      onClick={() => deleteOne(n.id, n.title)}
                      style={{
                        fontSize: 13,
                        marginLeft: "auto",
                        color: "#b00020",
                      }}
                      title="Xoá truyện"
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

      <section
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <button onClick={gotoFirst} disabled={page <= 1} style={{ padding: 8 }}>
          « Đầu
        </button>
        <button onClick={prev} disabled={page <= 1} style={{ padding: 8 }}>
          ← Trước
        </button>
        <span>
          Trang {page} / {totalPages}
        </span>
        <button
          onClick={next}
          disabled={page >= totalPages}
          style={{ padding: 8 }}
        >
          Sau →
        </button>
        <button
          onClick={gotoLast}
          disabled={page >= totalPages}
          style={{ padding: 8 }}
        >
          Cuối »
        </button>
      </section>
    </main>
  );
}
