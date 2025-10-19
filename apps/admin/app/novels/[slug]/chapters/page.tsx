"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Time from "@/components/Time";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

type Novel = {
  id: string;
  title: string;
  slug: string;
};

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

  // chọn/xoá nhiều
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // modal tạo chương
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [nextIndexLoading, setNextIndexLoading] = useState(false);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  // phân trang đơn giản
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);

  // bảo vệ: chưa có token thì chuyển login
  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  // load novel + chapters
  async function fetchNovelAndChapters(sl: string, p: number, l: number) {
    setLoading(true);
    setErr("");
    try {
      // novel
      const nres = await fetch(`${API}/v1/novels/${encodeURIComponent(sl)}`, {
        cache: "no-store",
      });
      if (!nres.ok) throw new Error(`Không lấy được truyện (${nres.status})`);
      const n = (await nres.json()) as Novel;
      setNovel(n);

      // chapters
      const cres = await fetch(
        `${API}/v1/novels/${encodeURIComponent(n.id)}/chapters?page=${p}&limit=${l}`,
        { cache: "no-store" }
      );
      if (!cres.ok)
        throw new Error(`Không lấy được danh sách chương (${cres.status})`);
      const list = (await cres.json()) as Chapter[];
      setItems(Array.isArray(list) ? list : []);
      setSelected(new Set()); // reset lựa chọn khi đổi trang/danh sách
    } catch (e: any) {
      setErr(e?.message ?? "Lỗi kết nối");
      setItems([]);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!slug) return;
    fetchNovelAndChapters(slug, page, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, page, limit]);

  // lấy next-index khi mở modal tạo chương (chỉ 1 lần mỗi lần mở)
  async function fetchNextIndex(novel_id: string) {
    try {
      setNextIndexLoading(true);
      setNextIndex(null);
      const res = await fetch(
        `${API}/v1/novels/${encodeURIComponent(novel_id)}/chapters/next-index`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json(); // { next_index: number }
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

  // tạo chương — dùng API auto-index (KHÔNG gửi index_no)
  const createChapter = async () => {
    if (!novel) return;
    if (!title.trim()) return;

    setCreating(true);
    try {
      const res = await fetch(
        `${API}/v1/novels/${encodeURIComponent(novel.id)}/chapters`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({ title: title.trim(), content }),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Tạo chương thất bại: ${res.status} ${t}`);
      }
      // reload list về trang 1 để dễ thấy chương mới
      setShowCreate(false);
      setTitle("");
      setContent("");
      setPage(1);
      await fetchNovelAndChapters(slug, 1, limit);
    } catch (e: any) {
      alert(e?.message ?? "Lỗi tạo chương");
    } finally {
      setCreating(false);
    }
  };

  // chọn 1 dòng
  const toggleRow = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // chọn tất cả ở trang hiện tại
  const toggleAll = () => {
    if (items.length === 0) return;
    const allIndices = new Set(items.map((c) => c.index_no));
    const allSelected = [...allIndices].every((i) => selected.has(i));
    if (allSelected) {
      // bỏ chọn tất cả
      setSelected((_) => {
        const next = new Set(selected);
        for (const i of allIndices) next.delete(i);
        return next;
      });
    } else {
      // chọn tất cả
      setSelected((_) => new Set([...selected, ...allIndices]));
    }
  };

  // xoá 1 chương
  const deleteOne = async (index_no: number) => {
    if (!novel) return;
    if (!confirm(`Xoá chương #${index_no}?`)) return;
    const res = await fetch(
      `${API}/v1/novels/${encodeURIComponent(novel.id)}/chapters/${index_no}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
      }
    );
    if (!res.ok) {
      const t = await res.text();
      alert(`Xoá thất bại: ${res.status} ${t}`);
      return;
    }
    await fetchNovelAndChapters(slug, page, limit);
  };

  // xoá nhiều chương
  const deleteSelected = async () => {
    if (!novel) return;
    const indices = [...selected].sort((a, b) => a - b);
    if (indices.length === 0) {
      alert("Vui lòng chọn ít nhất 1 chương.");
      return;
    }
    if (!confirm(`Xoá ${indices.length} chương đã chọn?`)) return;

    const res = await fetch(
      `${API}/v1/novels/${encodeURIComponent(novel.id)}/chapters`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ indices }),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      alert(`Xoá nhiều thất bại: ${res.status} ${t}`);
      return;
    }
    setSelected(new Set());
    // refetch trang hiện tại; nếu trang trống, lùi về trang 1
    await fetchNovelAndChapters(slug, page, limit);
    if (items.length === indices.length && page > 1) {
      setPage(1);
    }
  };

  const total = useMemo(() => items.length, [items]);
  const allChecked =
    items.length > 0 &&
    items.every((c) => selected.has(c.index_no)) &&
    selected.size >= items.length;
  const someChecked = items.some((c) => selected.has(c.index_no));

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
            onClick={deleteSelected}
            disabled={!someChecked}
            style={{ padding: "8px 12px", borderRadius: 8 }}
            title={someChecked ? "Xoá các chương đã chọn" : "Chưa chọn chương"}
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
              <th style={{ padding: 8, width: 36 }}>
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả"
                  checked={allChecked}
                  onChange={toggleAll}
                />
              </th>
              <th style={{ padding: 8, width: 80 }}>#</th>
              <th style={{ padding: 8 }}>Tiêu đề</th>
              <th style={{ padding: 8, width: 160 }}>Cập nhật</th>
              <th style={{ padding: 8, width: 200 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                <td style={{ padding: 8 }}>
                  <input
                    type="checkbox"
                    checked={selected.has(c.index_no)}
                    onChange={() => toggleRow(c.index_no)}
                    aria-label={`Chọn chương #${c.index_no}`}
                  />
                </td>
                <td style={{ padding: 8 }}>{c.index_no}</td>
                <td style={{ padding: 8 }}>{c.title}</td>
                <td style={{ padding: 8 }}>
                  <Time value={c.updated_at} />
                </td>
                <td style={{ padding: 8, display: "flex", gap: 10 }}>
                  <Link
                    href={`/novels/${encodeURIComponent(
                      slug
                    )}/chapters/${c.index_no}/edit`}
                  >
                    ✏️ Sửa
                  </Link>
                  <a
                    href={`http://localhost:3000/truyen/${encodeURIComponent(
                      slug
                    )}/chuong/${c.index_no}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    👁️ Xem
                  </a>
                  <button
                    onClick={() => deleteOne(c.index_no)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "#ffe9ea",
                      border: "1px solid #ffd1d4",
                    }}
                    title={`Xoá chương #${c.index_no}`}
                  >
                    🗑️ Xoá
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* phân trang đơn giản */}
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

      {/* Modal tạo chương */}
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
