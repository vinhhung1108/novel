export type Author = { id: string; name: string };
export type Category = { id: string; name: string; slug: string };
export type Tag = { id: string; name: string; slug: string };

export type FormState = {
  title: string;
  slug: string;
  autoSlug: boolean;
  description: string;
  originalTitle: string;
  altTitles: string;
  languageCode: string;
  isFeatured: boolean;
  mature: boolean;
  priority: number;
  authorId: string;
  categoryIds: string[];
  tagIds: string[];
  status: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
};

export type CreateNovelPayload = {
  title: string;
  slug: string;
  description?: string;
  cover_image_key?: string;
  original_title?: string;
  alt_titles?: string[];
  language_code?: string;
  is_featured: boolean;
  mature: boolean;
  priority: number;
  author_id?: string;
  status?: string;
  source?: string;
  source_url?: string;
  published_at?: string;
};

export type CropArea = { x: number; y: number; width: number; height: number };

export type SlugStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid"
  | "error";

export type UpdateNovelPayload = {
  title: string;
  slug: string;
  description: string;
  cover_image_key: string | null;
  original_title: string | null;
  alt_titles: string[];
  language_code: string | null;
  is_featured: boolean;
  mature: boolean;
  priority: number;
  author_id: string | null;
  status: string | null;
  source: string | null;
  source_url: string | null;
  published_at: string | null;
};

export type NovelDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_key: string | null;
  status: string | null;
  source: string | null;
  source_url: string | null;
  author_id: string | null;
  rating_avg: number | string | null;
  rating_count: number | string | null;
  words_count: string | number;
  views: string | number;
  published_at: string | null;
  updated_at: string;
  original_title: string | null;
  alt_titles: string[] | null;
  language_code: string | null;
  is_featured: boolean;
  mature: boolean;
  priority: number;
  category_ids?: string[];
  tag_ids?: string[];
};

export type NovelSummary = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  cover_image_key?: string | null;
  status?: string | null;
  words_count?: string | number;
  views?: string | number;
  updated_at: string;
};

export type NovelListResponse = {
  items: NovelSummary[];
  total: number;
  page: number;
  limit: number;
};
