import type { MetadataRoute } from "next";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

async function getJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  try {
    return await res.json();
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const novels: any[] = await getJson(`${API}/v1/novels?page=1&limit=200`);
  const items: MetadataRoute.Sitemap = [
    { url: "http://localhost:3000/", lastModified: new Date() },
  ];
  for (const n of novels) {
    items.push({
      url: `http://localhost:3000/truyen/${n.slug}`,
      lastModified: new Date(n.updated_at ?? Date.now()),
    });
    const chs: any[] = await getJson(
      `${API}/v1/novels/${n.id}/chapters?limit=1000`
    );
    for (const c of chs) {
      items.push({
        url: `http://localhost:3000/truyen/${n.slug}/chuong/${c.index_no}`,
        lastModified: new Date(c.updated_at ?? n.updated_at ?? Date.now()),
      });
    }
  }
  return items;
}
