import type { CreateNovelPayload, FormState } from "./types";
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
