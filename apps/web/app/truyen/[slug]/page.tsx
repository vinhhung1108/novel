import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
const CDN =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ?? "http://localhost:9000/novels";

async function getNovel(slug: string) {
  try {
    const res = await fetch(`${API}/v1/novels/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      id: string;
      title: string;
      slug: string;
      description?: string | null;
      cover_image_key?: string | null;
      updated_at: string;
    };
  } catch {
    return null;
  }
}

async function getChapters(novel_id: string, limit = 20) {
  try {
    const res = await fetch(
      `${API}/v1/novels/${encodeURIComponent(
        novel_id
      )}/chapters?page=1&limit=${limit}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    return (await res.json()) as Array<{
      id: string;
      novel_id: string;
      index_no: number;
      title: string;
    }>;
  } catch {
    return [];
  }
}

export default async function NovelPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = decodeURIComponent(params.slug);
  const novel = await getNovel(slug);

  if (!novel) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Không tìm thấy truyện</h1>
        <Link href="/">← Về trang chủ</Link>
      </main>
    );
  }

  // Fire-and-forget tăng view (không await, không TS expect error)
  fetch(`${API}/v1/novels/${novel.id}/view`, { method: "POST" }).catch(
    () => {}
  );

  const chapters = await getChapters(novel.id, 50);

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <div
        style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}
      >
        <div
          style={{
            width: 200,
            aspectRatio: "3/4",
            background: "#f5f5f5",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {novel.cover_image_key ? (
            <img
              src={`${CDN}/${novel.cover_image_key}`}
              alt={novel.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <h1 style={{ margin: 0 }}>{novel.title}</h1>
          <div style={{ color: "#666" }}>/ {novel.slug}</div>
          {novel.description ? <p>{novel.description}</p> : null}
        </div>
      </div>

      <section style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Danh sách chương</h2>
        {chapters.length === 0 ? (
          <div>Truyện chưa có chương.</div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 8,
            }}
          >
            {chapters.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/truyen/${encodeURIComponent(
                    novel.slug
                  )}/chuong/${c.index_no}`}
                >
                  Chương {c.index_no}: {c.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
