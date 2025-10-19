"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

type ChapterLite = { index_no: number; title: string };

export default function ChapterPicker({
  slug,
  novelId,
  currentIndex,
  pageSize = 100, // tải mỗi lần 100 chương
}: {
  slug: string;
  novelId: string;
  currentIndex: number;
  pageSize?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // paging state
  const [items, setItems] = useState<ChapterLite[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // jump to
  const [jump, setJump] = useState<number | "">("");
  const [search, setSearch] = useState(""); // filter client-side trên phần đã tải
  const listRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  const totalStr = useMemo(() => (total ?? "…").toString(), [total]);

  const openModal = () => {
    setOpen(true);
    // reset/lần đầu sẽ load trang 1
    if (items.length === 0) {
      void loadPage(1);
    }
  };

  const closeModal = () => setOpen(false);

  async function loadPage(p: number) {
    if (loading) return;
    setLoading(true);
    try {
      const url = new URL(
        `${API}/v1/novels/${encodeURIComponent(novelId)}/chapters`
      );
      url.searchParams.set("page", String(p));
      url.searchParams.set("limit", String(pageSize));
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        // giữ nguyên items cũ
        setHasMore(false);
        return;
      }
      const data = (await res.json()) as
        | ChapterLite[]
        | { items: ChapterLite[]; total: number };
      // API hiện tại trả mảng [] — ta hỗ trợ cả 2 dạng
      let rows: ChapterLite[] = Array.isArray(data) ? data : (data.items ?? []);
      // sort tăng theo index_no
      rows = rows.sort((a, b) => a.index_no - b.index_no);

      setItems((prev) => (p === 1 ? rows : [...prev, ...rows]));
      if (!Array.isArray(data) && typeof data.total === "number") {
        setTotal(data.total);
        setHasMore(p * pageSize < data.total);
      } else {
        // nếu API trả mảng thuần, tạm đoán: hết khi < pageSize
        setHasMore(rows.length === pageSize);
      }
      setPage(p);
    } finally {
      setLoading(false);
    }
  }

  // infinite scroll: nạp thêm khi gần cuối
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
      if (nearBottom && hasMore && !loading) {
        void loadPage(page + 1);
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, page, hasMore, loading]);

  // Đóng modal khi bấm ESC / click nền
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) closeModal();
  };

  // filter client-side cho phần đã tải
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (it) =>
        String(it.index_no).includes(s) ||
        (it.title || "").toLowerCase().includes(s)
    );
  }, [items, search]);

  const go = (index_no: number) => {
    closeModal();
    router.push(`/truyen/${encodeURIComponent(slug)}/chuong/${index_no}`);
  };

  const tryJump = () => {
    const n = Number(jump);
    if (Number.isFinite(n) && n > 0) go(n);
  };

  return (
    <>
      <button
        onClick={openModal}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #ddd",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        📚 Danh sách chương
      </button>

      {!open ? null : (
        <div
          ref={backdropRef}
          onClick={onBackdrop}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
          aria-modal="true"
          role="dialog"
        >
          <div
            style={{
              width: "min(720px, 96vw)",
              background: "#fff",
              borderRadius: 12,
              padding: 16,
              boxShadow:
                "0 10px 20px rgba(0,0,0,0.12), 0 6px 6px rgba(0,0,0,0.12)",
              display: "grid",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <strong style={{ fontSize: 18 }}>
                Chọn chương nhanh {total ? `(~${totalStr} chương)` : ""}
              </strong>
              <button
                onClick={closeModal}
                aria-label="Đóng"
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            {/* Thanh công cụ: search + jump */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Lọc trong danh sách đã tải (số chương hoặc tiêu đề)…"
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  width: "100%",
                }}
              />
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={jump}
                  onChange={(e) =>
                    setJump(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="Nhảy tới #"
                  style={{
                    width: 110,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    textAlign: "center",
                  }}
                />
                <button
                  onClick={tryJump}
                  disabled={jump === "" || Number(jump) <= 0}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #0ea5e9",
                    background: "#0ea5e9",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Đi
                </button>
              </div>
              <div style={{ fontSize: 12, color: "#666", textAlign: "right" }}>
                Đang xem chương hiện tại: <b>#{currentIndex}</b>
              </div>
            </div>

            {/* Danh sách ảo đơn giản + lazy load */}
            <div
              ref={listRef}
              style={{
                maxHeight: "60vh",
                overflow: "auto",
                border: "1px solid #eee",
                borderRadius: 8,
              }}
            >
              {visible.length === 0 ? (
                <div style={{ padding: 12, color: "#666" }}>
                  {loading ? "Đang tải…" : "Không có kết quả."}
                </div>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "grid",
                  }}
                >
                  {visible.map((c) => (
                    <li key={c.index_no}>
                      <button
                        onClick={() => go(c.index_no)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "80px 1fr",
                          gap: 8,
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          border: "none",
                          borderBottom: "1px solid #f0f0f0",
                          background:
                            c.index_no === currentIndex ? "#f0f9ff" : "white",
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            fontVariantNumeric: "tabular-nums",
                            color: "#0ea5e9",
                          }}
                        >
                          #{c.index_no}
                        </span>
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.title || "(không tiêu đề)"}
                        </span>
                      </button>
                    </li>
                  ))}
                  {/* Chân danh sách: hiển thị trạng thái tải thêm */}
                  <li
                    style={{ padding: 10, textAlign: "center", color: "#666" }}
                  >
                    {loading
                      ? "Đang tải…"
                      : hasMore
                        ? "Cuộn xuống để tải thêm…"
                        : "Đã tải hết."}
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
