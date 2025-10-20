import type {
  CreateNovelPayload,
  FormState,
  UpdateNovelPayload,
} from "./types";
import { slugifySafe } from "@/app/lib/slug";

export function parseAltTitles(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildCreatePayload(
  form: FormState,
  coverKey: string | null
): CreateNovelPayload {
  const altTitles = parseAltTitles(form.altTitles);
  const language = form.languageCode.trim();
  const original = form.originalTitle.trim();
  const priority = Number.isFinite(form.priority)
    ? Math.max(0, form.priority)
    : 0;

  const payload: CreateNovelPayload = {
    title: form.title.trim(),
    slug: form.slug.trim(),
    description: form.description || undefined,
    cover_image_key: coverKey ?? undefined,
    original_title: original || undefined,
    alt_titles: altTitles.length ? altTitles : undefined,
    language_code: language || undefined,
    is_featured: form.isFeatured,
    mature: form.mature,
    priority,
    author_id: form.authorId || undefined,
  };

  const status = form.status.trim();
  if (status) payload.status = status;

  const source = form.source.trim();
  if (source) payload.source = source;

  const sourceUrl = form.sourceUrl.trim();
  if (sourceUrl) payload.source_url = sourceUrl;

  const publishedAt = form.publishedAt.trim();
  if (publishedAt) payload.published_at = publishedAt;

  return payload;
}

export function nextSlugFromTitle(
  title: string,
  current: string,
  auto: boolean
) {
  if (!auto) return current;
  const next = slugifySafe(title);
  return next !== current ? next : current;
}

export function buildUpdatePayload(
  form: FormState,
  coverKey: string | null
): UpdateNovelPayload {
  const altTitles = parseAltTitles(form.altTitles);
  const language = form.languageCode.trim();
  const original = form.originalTitle.trim();
  const priority = Number.isFinite(form.priority)
    ? Math.max(0, form.priority)
    : 0;

  return {
    title: form.title.trim(),
    slug: form.slug.trim(),
    description: form.description,
    cover_image_key: coverKey,
    original_title: original || null,
    alt_titles: altTitles,
    language_code: language || null,
    is_featured: form.isFeatured,
    mature: form.mature,
    priority,
    author_id: form.authorId || null,
    status: form.status.trim() || null,
    source: form.source.trim() || null,
    source_url: form.sourceUrl.trim() || null,
    published_at: form.publishedAt.trim() || null,
  };
}

export function normalizeCollection<T>(
  input: T[] | { items?: T[] } | null | undefined
): T[] {
  if (Array.isArray(input)) return input;
  const items = (input as { items?: T[] } | undefined)?.items;
  return Array.isArray(items) ? items : [];
}
