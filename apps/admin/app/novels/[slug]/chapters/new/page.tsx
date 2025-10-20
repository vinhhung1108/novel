"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

type Novel = { id: string; title: string; slug: string };

export default function NewChapterPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = decodeURIComponent(params.slug);
  const router = useRouter();
  const { token, getAuthHeader } = useAuth();

  const [novel, setNovel] = useState<Novel | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [autoIndex, setAutoIndex] = useState(true);
  const [indexNo, setIndexNo] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // load novel
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/v1/novels/${slug}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setErr("Không tải được truyện");
          return;
        }
        const n = (await res.json()) as Novel;
        setNovel(n);
      } catch (e: any) {
        setErr(e?.message ?? "Lỗi kết nối");
      }
    })();
  }, [slug]);

  async function onCreate() {
    if (!novel || !token) return;
    try {
      setSaving(true);
      setErr("");
      const body: any = {
        title: title.trim(),
        content,
      };
      if (!autoIndex && indexNo) body.index_no = Number(indexNo);

      const res = await fetch(
        `${API}/v1/novels/${encodeURIComponent(novel.id)}/chapters`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        setErr(`Tạo chương thất bại (${res.status}) ${t}`);
        return;
      }
      // về danh sách chương
      router.replace(`/novels/${encodeURIComponent(slug)}/chapters`);
    } catch (e: any) {
      setErr(e?.message ?? "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href={`/novels/${encodeURIComponent(slug)}/chapters`}>
          ← Danh sách chương
        </Link>
        <h1 style={{ margin: 0 }}>Tạo chương mới</h1>
      </div>

      {err && <div style={{ color: "crimson" }}>{err}</div>}
      {!novel ? (
        <div>Đang tải…</div>
      ) : (
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666" }}>
              Tiêu đề
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chương 1: ..."
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label>
              <input
                type="checkbox"
                checked={autoIndex}
                onChange={(e) => setAutoIndex(e.target.checked)}
              />{" "}
              Tự sinh số chương
            </label>

            <input
              type="number"
              placeholder="index_no (ví dụ 1)"
              value={autoIndex ? "" : indexNo}
              onChange={(e) => setIndexNo(e.target.value as any)}
              disabled={autoIndex}
              min={1}
              style={{ width: 160 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666" }}>
              Nội dung (HTML)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="<p>Nội dung chương...</p>"
              style={{ width: "100%", minHeight: 220 }}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onCreate}
              disabled={!title.trim() || saving || !token}
              style={{ padding: "8px 12px", borderRadius: 8 }}
            >
              {saving ? "Đang tạo…" : "Tạo chương"}
            </button>
            <Link
              href={`/novels/${encodeURIComponent(slug)}/chapters`}
              style={{
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 8,
                textDecoration: "none",
                color: "#111",
              }}
            >
              Huỷ
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
