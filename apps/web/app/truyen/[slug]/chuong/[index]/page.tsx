// apps/web/app/truyen/[slug]/chuong/[index]/page.tsx
import ChapterPicker from "./ChapterPicker";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
const CDN =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ?? "http://localhost:9000/novels";

type Novel = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  cover_image_key?: string | null;
};

type Chapter = {
  id: string;
  novel_id: string;
  index_no: number;
  title: string;
  contentHtml: string;
  updated_at: string;
};

async function getNovel(slug: string): Promise<Novel | null> {
  try {
    const res = await fetch(`${API}/v1/novels/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Novel;
  } catch {
    return null;
  }
}

async function getChapter(
  novel_id: string,
  index_no: number
): Promise<Chapter | null> {
  try {
    const res = await fetch(
      `${API}/v1/novels/${encodeURIComponent(novel_id)}/chapters/${index_no}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as
      | {
          chapter: {
            id: string;
            novel_id: string;
            index_no: number;
            title: string;
            updated_at: string;
          };
          body?: { content_html?: string | null; updated_at?: string };
        }
      | null;
    if (!data || !data.chapter) return null;

    const contentHtml =
      data.body?.content_html ??
      // fallback: một số API cũ trả trực tiếp trường content
      (data as unknown as { content?: string })?.content ??
      "<p>(Chưa có nội dung)</p>";

    return {
      id: data.chapter.id,
      novel_id: data.chapter.novel_id,
      index_no: data.chapter.index_no,
      title: data.chapter.title,
      updated_at: data.chapter.updated_at,
      contentHtml,
    };
  } catch {
    return null;
  }
}

/** Một số bản Next 15 yêu cầu await params để tránh warning “sync dynamic apis” */
export default async function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string; index: string }>;
}) {
  const p = await params;
  const slug = p.slug;
  const index = Number(p.index);

  const novel = await getNovel(slug);
  if (!novel) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Không tìm thấy truyện</h1>
        <p>
          <a href="/">← Về trang chủ</a>
        </p>
      </main>
    );
  }

  const chapter = await getChapter(novel.id, index);

  // Gợi ý prev/next tối giản theo số (next có thể 404 nếu chưa tồn tại — không sao)
  const prevIndex = index > 1 ? index - 1 : null;
  const nextIndex = index + 1;

  // Ghi nhận lượt xem (không chặn UI)
  void (async () => {
    try {
      await fetch(`${API}/v1/novels/${encodeURIComponent(novel.id)}/view`, {
        method: "POST",
        cache: "no-store",
      });
    } catch {
      /* noop */
    }
  })();

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <header style={{ display: "grid", gap: 8 }}>
        <a href={`/truyen/${encodeURIComponent(novel.slug)}`}>
          &larr; Về trang truyện
        </a>
        <h1 style={{ margin: 0 }}>{novel.title}</h1>
        <div style={{ fontSize: 14, color: "#666" }}>Chương {index}</div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {prevIndex ? (
            <a
              href={`/truyen/${encodeURIComponent(slug)}/chuong/${prevIndex}`}
              style={{
                padding: "6px 10px",
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
            >
              ← Chương {prevIndex}
            </a>
          ) : null}

          {/* ✅ Modal chọn chương — lazy load 100 mục/đợt + ô “Nhảy tới #” */}
          <ChapterPicker
            slug={novel.slug}
            novelId={novel.id}
            currentIndex={index}
          />

          <a
            href={`/truyen/${encodeURIComponent(slug)}/chuong/${nextIndex}`}
            style={{
              padding: "6px 10px",
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          >
            Chương {nextIndex} →
          </a>
        </div>
      </header>

      {chapter ? (
        <article
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            lineHeight: 1.75,
          }}
          dangerouslySetInnerHTML={{
            __html: chapter.contentHtml,
          }}
        />
      ) : (
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            background: "#fffef0",
          }}
        >
          Không tìm thấy chương này. Bạn có thể mở “Danh sách chương” để chọn
          nhanh chương khác.
        </div>
      )}

      <footer
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {prevIndex ? (
            <a
              href={`/truyen/${encodeURIComponent(slug)}/chuong/${prevIndex}`}
              style={{
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
            >
              ← Chương {prevIndex}
            </a>
          ) : (
            <span />
          )}
        </div>
        <div>
          <a
            href={`/truyen/${encodeURIComponent(slug)}/chuong/${nextIndex}`}
            style={{
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          >
            Chương {nextIndex} →
          </a>
        </div>
      </footer>
    </main>
  );
}
