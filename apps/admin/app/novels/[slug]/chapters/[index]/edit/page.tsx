"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { API, apiFetch } from "@/lib/auth";

type ChapterFull = {
  chapter: {
    id: string;
    novel_id: string;
    index_no: number;
    title: string;
    slug?: string | null;
    updated_at: string;
    words_count: number;
  };
  body?: { content_html: string } | null;
};

export default function EditChapterPage() {
  const params = useParams<{ slug: string; index: string }>();
  const slug = decodeURIComponent(params.slug);
  const index = Number(params.index);

  const router = useRouter();
  const { token } = useAuth();

  const [novelId, setNovelId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      // resolve novel id by slug
      const nres = await fetch(`${API}/v1/novels/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      if (!nres.ok) return setMsg("Không tải được truyện");
      const n = await nres.json();
      setNovelId(n.id);
      // load chapter
      const cres = await fetch(
        `${API}/v1/novels/${encodeURIComponent(n.id)}/chapters/${index}`,
        { cache: "no-store" }
      );
      if (!cres.ok) return setMsg("Không tải được chương");
      const ch = (await cres.json()) as ChapterFull;
      setTitle(ch.chapter.title);
      setContent(ch.body?.content_html ?? "");
    })();
  }, [slug, index]);

  const save = async () => {
    if (!novelId) return;
    if (!title.trim()) {
      setMsg("Tiêu đề không được rỗng");
      return;
    }
    setSaving(true);
    const res = await apiFetch(
      `/v1/novels/${novelId}/chapters/${index}`,
      {
        method: "PATCH",
        body: JSON.stringify({ title: title.trim(), content }),
      },
      token || undefined
    );
    setSaving(false);
    if (!res.ok) {
      setMsg(`Lưu thất bại: ${await res.text()}`);
      return;
    }
    router.push(`/novels/${encodeURIComponent(slug)}/chapters`);
  };

  return (
    <main style={{ padding: 16, display: "grid", gap: 10 }}>
      <h1>Sửa chương #{index}</h1>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={18}
        style={{ fontFamily: "monospace", padding: 10 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => router.back()}>↩ Quay lại</button>
        <button
          onClick={save}
          disabled={!title.trim() || saving}
          style={{ padding: "8px 12px", borderRadius: 8 }}
        >
          {saving ? "Đang lưu…" : "💾 Lưu & quay lại"}
        </button>
        {msg && (
          <span
            style={{
              color: msg.startsWith("Lưu thất bại") ? "crimson" : "green",
            }}
          >
            {msg}
          </span>
        )}
      </div>
    </main>
  );
}
