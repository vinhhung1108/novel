// apps/api/src/crawl/writers.ts
import slugifyLib from "slugify";
import { DataSource, EntityManager } from "typeorm";

/** ---------- Input types ---------- */
export type UpsertSeriesInput = {
  title: string;
  authorName?: string | null; // có thể null
  coverUrl?: string | null; // (không lưu vào novels — bạn có thể map sang storage sau)
  description?: string | null;
  sourceId: string;
  extSeriesId: string; // slug/đường dẫn ngoài
  url?: string | null; // link trang gốc
  originalTitle?: string | null;
  altTitles?: string[] | null;
  languageCode?: string | null; // ví dụ: "vi"
};

export type UpsertChapterInput = {
  sourceId: string;
  extChapterId: string; // unique theo nguồn
  seriesId: string; // novels.id
  indexNo?: number | null;
  title?: string | null;
  content?: string | null; // text/html đã normalize — sẽ lưu vào chapter_bodies
  extUrl?: string | null;
};

/** ---------- Helpers ---------- */

function slugify(s: string): string {
  return slugifyLib(s, { lower: true, strict: true, trim: true, locale: "vi" });
}

function nonEmpty(s?: string | null): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

/** Upsert 1 tác giả theo slug (null nếu không có tên) */
async function upsertAuthor(
  trx: EntityManager,
  name?: string | null
): Promise<string | null> {
  const n = nonEmpty(name);
  if (!n) return null;

  const authorSlug = slugify(n);

  // Bảng authors: columns (id uuid pk, name text, slug text unique, created_at, updated_at)
  const rows = await trx.query(
    `
    INSERT INTO authors (name, slug)
    VALUES ($1, $2)
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name
    RETURNING id
    `,
    [n, authorSlug]
  );

  return rows?.[0]?.id ?? null;
}

/** ---------- Public functions ---------- */

/**
 * Upsert series/novel vào bảng `novels` và map vào `series_source_map`.
 * - novels unique theo (slug)
 * - series_source_map unique theo (source_id, ext_series_id)
 */
export async function upsertSeries(
  ds: DataSource,
  input: UpsertSeriesInput
): Promise<{ seriesId: string }> {
  const title = input.title?.trim();
  if (!title) throw new Error("upsertSeries: missing title");

  const slug = slugify(title);

  const res = await ds.transaction(async (trx) => {
    const authorId = await upsertAuthor(trx, input.authorName).catch(
      () => null
    );

    // Lưu vào novels
    // Lưu ý: cover_image_key chưa có ở crawler, để null.
    //       source = 'crawler', source_url = input.url
    const novelRows = await trx.query(
      `
      INSERT INTO novels (
        title,
        slug,
        description,
        cover_image_key,
        status,
        source,
        source_url,
        author_id,
        original_title,
        alt_titles,
        language_code
      )
      VALUES ($1,$2,$3,$4,'ongoing','crawler',$5,$6,$7,$8,$9)
      ON CONFLICT (slug) DO UPDATE SET
        title          = EXCLUDED.title,
        description    = COALESCE(NULLIF(EXCLUDED.description, ''), novels.description),
        author_id      = COALESCE(EXCLUDED.author_id, novels.author_id),
        source         = EXCLUDED.source,
        source_url     = COALESCE(EXCLUDED.source_url, novels.source_url),
        original_title = COALESCE(EXCLUDED.original_title, novels.original_title),
        alt_titles     = COALESCE(EXCLUDED.alt_titles, novels.alt_titles),
        language_code  = COALESCE(EXCLUDED.language_code, novels.language_code)
      RETURNING id
      `,
      [
        title,
        slug,
        input.description ?? "",
        null, // cover_image_key
        input.url ?? null, // source_url
        authorId, // author_id
        nonEmpty(input.originalTitle),
        input.altTitles ?? null, // text[]
        nonEmpty(input.languageCode),
      ]
    );
    const seriesId: string = novelRows[0].id;

    // Map vào series_source_map nếu bảng tồn tại
    await trx
      .query(
        `
        INSERT INTO series_source_map (source_id, ext_series_id, novel_id, url)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (source_id, ext_series_id) DO UPDATE SET
          novel_id = EXCLUDED.novel_id,
          url      = COALESCE(EXCLUDED.url, series_source_map.url)
        `,
        [input.sourceId, input.extSeriesId, seriesId, input.url ?? null]
      )
      .catch(() => {
        // Bảng/map có thể chưa migrate — bỏ qua để không làm hỏng crawl
      });

    return { seriesId };
  });

  return res;
}

/**
 * Upsert 1 chapter vào `chapters` và body vào `chapter_bodies`,
 * đồng thời map vào `chapter_source_map` nếu có.
 */
export async function upsertChapter(
  ds: DataSource,
  input: UpsertChapterInput
): Promise<{ chapterId: string; indexNo: number }> {
  const idx =
    Number.isFinite(input.indexNo as number) && (input.indexNo as number) > 0
      ? (input.indexNo as number)
      : 1;
  const title = nonEmpty(input.title) ?? `Chương ${idx}`;
  // slug cho chapter (không bắt buộc dùng, nhưng giúp debugging/hiển thị tốt hơn)
  const chapSlug = slugify(`${title}-${idx}`);

  const res = await ds.transaction(async (trx) => {
    // 1) Upsert chapters theo unique (novel_id, index_no)
    const chapterRows = await trx.query(
      `
      INSERT INTO chapters (novel_id, index_no, title, slug)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (novel_id, index_no) DO UPDATE SET
        title = COALESCE(NULLIF(EXCLUDED.title, ''), chapters.title)
      RETURNING id
      `,
      [input.seriesId, idx, title, chapSlug]
    );
    const chapterId: string = chapterRows[0].id;

    // 2) Upsert body (nếu có nội dung)
    if (nonEmpty(input.content)) {
      await trx.query(
        `
        INSERT INTO chapter_bodies (chapter_id, novel_id, content_html)
        VALUES ($1, $2, $3)
        ON CONFLICT (chapter_id) DO UPDATE SET
          content_html = EXCLUDED.content_html,
          updated_at   = now()
        `,
        [chapterId, input.seriesId, input.content]
      );
    }

    // 3) Map chapter_source_map (nếu bảng có)
    await trx
      .query(
        `
        INSERT INTO chapter_source_map (source_id, ext_chapter_id, chapter_id, novel_id, index_no, url)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (source_id, ext_chapter_id) DO UPDATE SET
          chapter_id = EXCLUDED.chapter_id,
          novel_id   = EXCLUDED.novel_id,
          index_no   = EXCLUDED.index_no,
          url        = COALESCE(EXCLUDED.url, chapter_source_map.url)
        `,
        [
          input.sourceId,
          input.extChapterId,
          chapterId,
          input.seriesId,
          idx,
          input.extUrl ?? null,
        ]
      )
      .catch(() => {
        // Có thể chưa có migration map — bỏ qua
      });

    return { chapterId, indexNo: idx };
  });

  return res;
}
