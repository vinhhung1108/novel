"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Time from "@/components/Time";
import { API, apiFetch } from "../../../lib/auth";

type Novel = { id: string; title: string; slug: string };
type Chapter = {
  id: string;
  novel_id: string;
  index_no: number;
  title: string;
  words_count: number;
  published_at: string | null;
  updated_at: string;
};

export default function NovelChaptersPage() {
  const { slug } = useParams<{ slug: string }>();
  const { token, getAuthHeader } = useAuth();
  const router = useRouter();

  const [novel, setNovel] = useState<Novel | null>(null);
  const [items, setItems] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);

  // tạo nhanh
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [nextIndexLoading, setNextIndexLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // chọn xoá nhiều
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  async function load(sl: string, p: number, l: number) {
    setLoading(true);
    setErr("");
    try {
      const nres = await fetch(`${API}/v1/novels/${encodeURIComponent(sl)}`, {
        cache: "no-store",
      });
      if (!nres.ok) throw new Error(`Không lấy được truyện (${nres.status})`);
      const n = (await nres.json()) as Novel;
      setNovel(n);

      const cres = await fetch(
        `${API}/v1/novels/${encodeURIComponent(n.id)}/chapters?page=${p}&limit=${l}`,
        { cache: "no-store" }
      );
      if (!cres.ok)
        throw new Error(`Không lấy được danh sách chương (${cres.status})`);
      const list = (await cres.json()) as Chapter[];
      setItems(Array.isArray(list) ? list : []);
      setChecked({});
    } catch (e: any) {
      setErr(e?.message ?? "Lỗi kết nối");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!slug) return;
    load(slug, page, limit);
  }, [slug, page, limit]);

  async function fetchNextIndex(novel_id: string) {
    try {
      setNextIndexLoading(true);
      setNextIndex(null);
      const res = await fetch(
        `${API}/v1/novels/${novel_id}/chapters/next-index`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNextIndex(Number(data?.next_index ?? 1));
    } catch {
      setNextIndex(null);
    } finally {
      setNextIndexLoading(false);
    }
  }

  const openCreate = async () => {
    if (!novel) return;
    setTitle("");
    setContent("");
    setShowCreate(true);
    await fetchNextIndex(novel.id);
  };

  const createChapter = async () => {
    if (!novel || !title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(
        `${API}/v1/novels/${encodeURIComponent(novel.id)}/chapters`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ title: title.trim(), content }),
        }
      );
      if (!res.ok)
        throw new Error(
          `Tạo chương thất bại: ${res.status} ${await res.text()}`
        );
      setShowCreate(false);
      setPage(1);
      await load(slug, 1, limit);
    } catch (e: any) {
      alert(e?.message ?? "Lỗi tạo chương");
    } finally {
      setCreating(false);
    }
  };

  const removeOne = async (index_no: number) => {
    if (!novel) return;
    if (!confirm(`Xoá chương #${index_no}?`)) return;
    const res = await apiFetch(
      `/v1/novels/${novel.id}/chapters/${index_no}`,
      { method: "DELETE" },
      token || undefined
    );
    if (!res.ok) {
      alert(`Xoá thất bại: ${await res.text()}`);
      return;
    }
    await load(slug, page, limit);
  };

  const removeMany = async () => {
    if (!novel) return;
    const pick = items.filter((i) => checked[i.id]).map((i) => i.index_no);
    if (pick.length === 0) return alert("Chưa chọn chương");
    if (!confirm(`Xoá ${pick.length} chương đã chọn?`)) return;
    const res = await apiFetch(
      `/v1/novels/${novel.id}/chapters/bulk-delete`,
      { method: "POST", body: JSON.stringify({ indexes: pick }) },
      token || undefined
    );
    if (!res.ok) {
      alert(`Xoá thất bại: ${await res.text()}`);
      return;
    }
    await load(slug, page, limit);
  };

  const total = useMemo(() => items.length, [items]);

  return (
    <main style={{ display: "grid", gap: 16, padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link href="/novels/list">← Danh sách truyện</Link>
        <h1 style={{ margin: 0 }}>
          {novel ? `Chương – ${novel.title}` : "Chương"}
        </h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={openCreate}
            style={{ padding: "8px 12px", borderRadius: 8 }}
          >
            ➕ Chương mới
          </button>
          <button
            onClick={removeMany}
            style={{ padding: "8px 12px", borderRadius: 8, color: "crimson" }}
          >
            🗑️ Xoá đã chọn
          </button>
        </div>
      </div>

      {loading ? (
        <div>Đang tải…</div>
      ) : err ? (
        <div style={{ color: "crimson" }}>{err}</div>
      ) : items.length === 0 ? (
        <div>Chưa có chương nào.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
              <th style={{ padding: 8, width: 36 }}></th>
              <th style={{ padding: 8, width: 80 }}>#</th>
              <th style={{ padding: 8 }}>Tiêu đề</th>
              <th style={{ padding: 8, width: 160 }}>Cập nhật</th>
              <th style={{ padding: 8, width: 220 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                <td style={{ padding: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!checked[c.id]}
                    onChange={(e) =>
                      setChecked((s) => ({ ...s, [c.id]: e.target.checked }))
                    }
                  />
                </td>
                <td style={{ padding: 8 }}>{c.index_no}</td>
                <td style={{ padding: 8 }}>{c.title}</td>
                <td style={{ padding: 8 }}>
                  <Time value={c.updated_at} />
                </td>
                <td style={{ padding: 8, display: "flex", gap: 10 }}>
                  <Link
                    href={`/novels/${encodeURIComponent(slug)}/chapters/${c.index_no}/edit`}
                  >
                    ✏️ Sửa
                  </Link>
                  <a
                    href={`http://localhost:3000/truyen/${encodeURIComponent(slug)}/chuong/${c.index_no}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    👁️ Xem
                  </a>
                  <button
                    onClick={() => removeOne(c.index_no)}
                    style={{
                      color: "crimson",
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    🗑️ Xoá
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* phân trang */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => setPage(1)} disabled={page === 1}>
          « Đầu
        </button>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          ← Trước
        </button>
        <span>Trang {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={items.length < limit}
        >
          Sau →
        </button>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          {[30, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}/trang
            </option>
          ))}
        </select>
        <span style={{ marginLeft: "auto", color: "#666" }}>
          Tổng hiển thị: {total}
        </span>
      </div>

      {/* Modal tạo */}
      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(900px, 96vw)",
              background: "#fff",
              borderRadius: 12,
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>Tạo chương mới</h3>
            <div style={{ fontSize: 13, color: "#555" }}>
              {nextIndexLoading ? (
                "Đang tính số chương kế tiếp…"
              ) : nextIndex != null ? (
                <>
                  Số chương kế tiếp dự kiến: <b>#{nextIndex}</b>
                </>
              ) : (
                "Không tính được số chương kế tiếp"
              )}
            </div>
            <input
              placeholder="Tiêu đề chương"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8 }}
            />
            <textarea
              placeholder="Nội dung (HTML)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              style={{ padding: 10, borderRadius: 8, fontFamily: "monospace" }}
            />
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button onClick={() => setShowCreate(false)}>Huỷ</button>
              <button
                onClick={createChapter}
                disabled={!title.trim() || creating}
                style={{ padding: "8px 12px", borderRadius: 8 }}
              >
                {creating ? "Đang tạo…" : "Tạo chương"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
