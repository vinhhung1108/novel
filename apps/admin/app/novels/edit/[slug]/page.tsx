"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { API, apiFetch } from "../../../lib/auth";

type Novel = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  cover_image_key?: string | null;
  status?: string;
  original_title?: string | null;
  alt_titles?: string[] | null;
  language_code?: string | null;
  is_featured?: boolean;
  mature?: boolean;
  priority?: number | null;
};

export default function EditNovelPage() {
  const { slug } = useParams<{ slug: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [n, setN] = useState<Novel | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`${API}/v1/novels/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      if (!res.ok) return setMsg("Không tải được truyện");
      setN(await res.json());
    })();
  }, [slug]);

  const save = async () => {
    if (!n) return;
    const res = await apiFetch(
      `/v1/novels/${n.id}`,
      { method: "PATCH", body: JSON.stringify(n) },
      token || undefined
    );
    if (!res.ok) {
      setMsg(`Lưu thất bại: ${await res.text()}`);
      return;
    }
    setMsg("Đã lưu ✓");
  };

  if (!n) return <main style={{ padding: 24 }}>Đang tải…</main>;

  return (
    <main style={{ padding: 24, display: "grid", gap: 12 }}>
      <h1>Sửa truyện — {n.title}</h1>
      <input
        value={n.title}
        onChange={(e) => setN({ ...n, title: e.target.value })}
        placeholder="Tiêu đề"
      />
      <input
        value={n.slug}
        onChange={(e) => setN({ ...n, slug: e.target.value })}
        placeholder="Slug"
      />
      <textarea
        value={n.description ?? ""}
        onChange={(e) => setN({ ...n, description: e.target.value })}
        rows={6}
        placeholder="Mô tả"
      />

      <input
        value={n.original_title ?? ""}
        onChange={(e) => setN({ ...n, original_title: e.target.value || null })}
        placeholder="Tên gốc"
      />
      <input
        value={(n.alt_titles ?? []).join(", ")}
        onChange={(e) =>
          setN({
            ...n,
            alt_titles: e.target.value
              ? e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : null,
          })
        }
        placeholder="Tên khác, phân tách phẩy"
      />
      <input
        value={n.language_code ?? ""}
        onChange={(e) => setN({ ...n, language_code: e.target.value || null })}
        placeholder="Mã ngôn ngữ (vd: vi, en, zh)"
      />

      <div style={{ display: "flex", gap: 12 }}>
        <label>
          <input
            type="checkbox"
            checked={!!n.is_featured}
            onChange={(e) => setN({ ...n, is_featured: e.target.checked })}
          />{" "}
          Featured
        </label>
        <label>
          <input
            type="checkbox"
            checked={!!n.mature}
            onChange={(e) => setN({ ...n, mature: e.target.checked })}
          />{" "}
          18+
        </label>
      </div>
      <input
        type="number"
        value={n.priority ?? 0}
        onChange={(e) => setN({ ...n, priority: Number(e.target.value) })}
        placeholder="Độ ưu tiên"
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save}>💾 Lưu</button>
        <button onClick={() => router.push("/novels/list")}>↩ Quay lại</button>
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
