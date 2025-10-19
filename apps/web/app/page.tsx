// apps/web/app/page.tsx
const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
const CDN =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ?? "http://localhost:9000/novels";

type Novel = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  cover_image_key?: string | null;
  updated_at: string;
};

type ListResp =
  | { items: Novel[]; total: number; page: number; limit: number } // API mới
  | Novel[]; // fallback API cũ

async function getNovels(): Promise<{ items: Novel[]; total: number }> {
  try {
    const res = await fetch(`${API}/v1/novels?limit=12`, { cache: "no-store" });
    if (!res.ok) return { items: [], total: 0 };
    const data = (await res.json()) as ListResp;
    if (Array.isArray(data)) {
      return { items: data, total: data.length };
    }
    return { items: data.items ?? [], total: (data as any).total ?? 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

export default async function Home() {
  const { items: novels, total } = await getNovels();

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1>NovelSite — Web</h1>

      <section style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <a href="http://localhost:3001" target="_blank" rel="noreferrer">
          Trang quản trị →
        </a>
        <span style={{ color: "#666", fontSize: 13 }}>
          (Tổng truyện: {total})
        </span>
      </section>

      {novels.length === 0 ? (
        <div>Chưa có truyện nào. Hãy vào admin để tạo truyện mới.</div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {novels.map((n) => (
            <li
              key={n.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <a
                href={`/truyen/${encodeURIComponent(n.slug)}`}
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "3/4",
                    background: "#f5f5f5",
                    overflow: "hidden",
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
                  <div style={{ fontSize: 12, color: "#666" }}>/ {n.slug}</div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
