import { apiGet, apiPost, AuthHeaderGetter } from "./apiClient";
import type {
  Author,
  Category,
  Tag,
  CreateNovelPayload,
} from "@/lib/novels/types"; // adjust path if needed

export const fetchAuthors = () => apiGet<Author[]>(`/authors?page=1&limit=500`);
export const fetchCategories = () =>
  apiGet<{ items: Category[] } | Category[]>(`/categories?page=1&limit=500`);
export const fetchTags = () =>
  apiGet<{ items: Tag[] } | Tag[]>(`/tags?page=1&limit=500`);

export const createNovel = (
  payload: CreateNovelPayload,
  getAuthHeader: AuthHeaderGetter
) => apiPost(`/novels`, payload, getAuthHeader);

export async function saveRelations(
  novelId: string,
  categoryIds: string[],
  tagIds: string[],
  getAuthHeader: AuthHeaderGetter
) {
  // optional if endpoints exist
  if (categoryIds.length) {
    await apiPost(
      `/novels/${novelId}/categories`,
      { category_ids: categoryIds },
      getAuthHeader
    );
  }
  if (tagIds.length) {
    await apiPost(
      `/novels/${novelId}/tags`,
      { tag_ids: tagIds },
      getAuthHeader
    );
  }
}

export async function slugExists(slug: string): Promise<boolean> {
  // support both styles
  const res = await fetch(
    `/api/novels/slug-exists/${encodeURIComponent(slug)}`,
    { cache: "no-store" }
  );
  if (res.status === 404) {
    const res2 = await fetch(
      `/api/novels/slug-exists?slug=${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );
    if (!res2.ok) throw new Error("slug check failed");
    const j = await res2.json();
    return Boolean(j?.exists);
  }
  if (!res.ok) throw new Error("slug check failed");
  const j = await res.json();
  return Boolean(j?.exists);
}
