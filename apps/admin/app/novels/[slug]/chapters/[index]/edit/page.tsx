"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

type Novel = { id: string; title: string; slug: string };
type Chapter = {
  id: string;
  novel_id: string;
  index_no: number;
  title: string;
  words_count: number;
  slug: string | null;
  published_at: string | null;
  updated_at: string;
};
type ChapterBody = { chapter_id: string; content_html: string };

export default function EditChapterPage() {
  const params = useParams<{ slug: string; index: string }>();
  const slug = decodeURIComponent(params.slug);
  const index = Number(params.index);

  const router = useRouter();
  const { token, getAuthHeader } = useAuth();

  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [indexNew, setIndexNew] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // guard
  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  // load novel + chapter
  useEffect(() => {
    (async () => {
      if (!slug || !Number.isFinite(index)) return;
      setLoading(true);
      setErr("");
      try {
        const nres = await fetch(
          `${API}/v1/novels/${encodeURIComponent(slug)}`,
          {
            cache: "no-store",
          }
        );
        if (!nres.ok) throw new Error(`Không lấy được truyện (${nres.status})`);
        const n: Novel = await nres.json();
        setNovel(n);

        const cres = await fetch(
          `${API}/v1/novels/${encodeURIComponent(n.id)}/chapters/${index}`,
          { cache: "no-store" }
        );
        if (!cres.ok) throw new Error(`Không lấy được chương (${cres.status})`);
        const {
          chapter: ch,
          body,
        }: { chapter: Chapter; body: ChapterBody | null } = await cres.json();
        setChapter(ch);
        setTitle(ch.title);
        setIndexNew(ch.index_no);
        setContent(body?.content_html ?? "");
      } catch (e: any) {
        setErr(e?.message ?? "Lỗi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, index]);

  const canSave = useMemo(() => {
    if (!title || !String(title).trim()) return false;
    if (saving) return false;
    return true;
  }, [title, saving]);

  const save = async () => {
    if (!novel || !chapter) return;
    if (!canSave) return;

    setSaving(true);
    try {
      const res = await fetch(
        `${API}/v1/novels/${encodeURIComponent(novel.id)}/chapters/${chapter.index_no}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            title: title.trim(),
            content,
            // nếu người dùng đổi số chương, gửi lên; nếu để nguyên, bỏ qua
            ...(indexNew && indexNew !== chapter.index_no
              ? { index_no: indexNew }
              : {}),
          }),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Lưu chương thất bại: ${res.status} ${t}`);
      }
      // ✅ quay lại danh sách chương
      router.push(`/novels/${encodeURIComponent(slug)}/chapters`);
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Lỗi lưu chương");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ padding: 16, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href={`/novels/${encodeURIComponent(slug)}/chapters`}>
          ← Danh sách chương
        </Link>
        <h1 style={{ margin: 0 }}>
          {novel ? `Sửa chương — ${novel.title}` : "Sửa chương"}
        </h1>
      </div>

      {loading ? (
        <div>Đang tải…</div>
      ) : err ? (
        <div style={{ color: "crimson" }}>{err}</div>
      ) : !chapter ? (
        <div>Không tìm thấy chương.</div>
      ) : (
        <section
          style={{
            display: "grid",
            gap: 12,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ width: 120 }}>Số chương</label>
            <input
              type="number"
              min={1}
              value={indexNew}
              onChange={(e) => {
                const v = e.target.value;
                setIndexNew(v === "" ? "" : Number(v));
              }}
              style={{ width: 140 }}
            />
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ width: 120 }}>Tiêu đề</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tiêu đề chương"
              style={{ flex: 1 }}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label>Nội dung (HTML)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              style={{ fontFamily: "monospace", padding: 10, borderRadius: 8 }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Link
              href={`/novels/${encodeURIComponent(slug)}/chapters`}
              style={{ padding: "8px 14px" }}
            >
              Hủy
            </Link>
            <button
              onClick={save}
              disabled={!canSave}
              style={{ padding: "8px 14px", borderRadius: 8 }}
            >
              {saving ? "Đang lưu…" : "💾 Lưu & quay lại"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
