const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

export type Overview = {
  novels: number;
  chapters: number;
  authors: number;
  tags: number;
};
export type SeriesItem = { date: string; views: number };
export type SeriesResp = { items: SeriesItem[] };
export type TopItem = {
  novel: {
    id: string;
    title: string;
    slug: string;
    cover_image_key: string | null;
    updated_at: string;
  };
  views: number;
};
export type TopResp = { items: TopItem[] };

export async function fetchOverview(): Promise<Overview | null> {
  const res = await fetch(`${API}/v1/stats`, { cache: "no-store" });
  if (res.status === 404) return null; // module stats chưa bật
  if (!res.ok) throw new Error(`Stats overview ${res.status}`);
  return res.json();
}

export async function fetchSeries(
  range = 7,
  granularity: "day" | "week" = "day"
): Promise<SeriesItem[] | null> {
  const res = await fetch(
    `${API}/v1/stats/series?granularity=${granularity}&range=${range}`,
    { cache: "no-store" }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Stats series ${res.status}`);
  const data = (await res.json()) as SeriesResp;
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchTop(
  days = 7,
  limit = 10
): Promise<TopItem[] | null> {
  const res = await fetch(`${API}/v1/stats/top?days=${days}&limit=${limit}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Stats top ${res.status}`);
  const data = (await res.json()) as TopResp;
  return Array.isArray(data.items) ? data.items : [];
}
