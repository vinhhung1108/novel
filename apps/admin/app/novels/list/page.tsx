"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Time from "@/components/Time";
import { API, apiFetch } from "../../lib/auth";

const CDN =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ?? "http://localhost:9000/novels";
type Novel = {
  id: string;
  title: string;
  slug: string;
  cover_image_key?: string | null;
  updated_at: string;
};

type ListResp =
  | Novel[]
  | { items: Novel[]; total: number; page: number; limit: number };
const toArray = (r: ListResp) => (Array.isArray(r) ? r : r.items || []);

export default function NovelsListPage() {
  const { token } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();

  const [q, setQ] = useState(sp.get("q") || "");
  const [page, setPage] = useState(Number(sp.get("page") || 1));
  const [limit, setLimit] = useState(Number(sp.get("limit") || 12));
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

  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  // sync URL
  useEffect(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    p.set("page", String(page));
    p.set("limit", String(limit));
    p.set("sort", sort);
    p.set("order", order);
    router.replace(`/novels/list?${p.toString()}`);
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
        const url = new URL(`${API}/v1/novels`);
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("sort", sort);
        url.searchParams.set("order", order);
        if (debouncedQ.trim()) url.searchParams.set("q", debouncedQ.trim());
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ListResp;
        const arr = toArray(data);
        setItems(arr);
        setTotal(Array.isArray(data) ? arr.length : data.total || 0);
      } catch (e: any) {
        setErr(e?.message ?? "Lỗi");
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [page, limit, sort, order, debouncedQ]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / (limit || 12))),
    [total, limit]
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, limit, sort, order]);

  const remove = async (id: string) => {
    if (!confirm("Xoá truyện này? Hành động không thể hoàn tác.")) return;
    const res = await apiFetch(
      `/v1/novels/${id}`,
      { method: "DELETE" },
      token || undefined
    );
    if (!res.ok) {
      alert(`Xoá thất bại: ${await res.text()}`);
      return;
    }
    // refresh
    const url = new URL(window.location.href);
    router.replace(url.pathname + url.search);
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
        <Link href="/novels" style={btn}>
          ➕ Tạo truyện
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
                    <button
                      onClick={() => remove(n.id)}
                      style={{
                        fontSize: 13,
                        color: "crimson",
                        background: "transparent",
                        border: 0,
                        cursor: "pointer",
                      }}
                    >
                      🗑️ Xoá
                    </button>
                    <a
                      href={`http://localhost:3000/truyen/${encodeURIComponent(n.slug)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13 }}
                    >
                      👁️ Xem web
                    </a>
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
        <button
          onClick={() => setPage(1)}
          disabled={page <= 1}
          style={{ padding: 8 }}
        >
          « Đầu
        </button>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          style={{ padding: 8 }}
        >
          ← Trước
        </button>
        <span>
          Trang {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          style={{ padding: 8 }}
        >
          Sau →
        </button>
        <button
          onClick={() => setPage(totalPages)}
          disabled={page >= totalPages}
          style={{ padding: 8 }}
        >
          Cuối »
        </button>
      </section>
    </main>
  );
}
const btn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: 8,
  textDecoration: "none",
  color: "#111",
  justifySelf: "end",
};
