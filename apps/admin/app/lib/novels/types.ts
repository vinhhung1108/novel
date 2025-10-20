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
};

export type CropArea = { x: number; y: number; width: number; height: number };

export type SlugStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid"
  | "error";
