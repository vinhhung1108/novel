import { DataSource } from "typeorm";
import { slugifySafe } from "@/common/utils/slug";
import { ensureCrawlSchema } from "./schema";

type EntityManager = ReturnType<DataSource["createEntityManager"]>;

function fallbackSlug(base: string, prefix: string): string {
  const normalized = slugifySafe(base);
  if (normalized) return normalized;
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureAuthor(em: EntityManager, name?: string): Promise<string> {
  const safeName = (name ?? "Unknown").trim() || "Unknown";

  const existing = (await em.query(
    `SELECT id FROM authors WHERE lower(name) = lower($1) LIMIT 1`,
    [safeName]
  )) as Array<{ id: string }>;
  if (existing[0]?.id) return existing[0].id;

  const baseSlug = slugifySafe(safeName) || fallbackSlug(safeName, "author");
  let slug = baseSlug;
  for (let i = 2; ; i++) {
    const dup = (await em.query(
      `SELECT 1 FROM authors WHERE slug = $1 LIMIT 1`,
      [slug]
    )) as Array<Record<string, unknown>>;
    if (!dup[0]) break;
    slug = `${baseSlug}-${i}`;
    if (i > 200) throw new Error("Cannot generate unique author slug");
  }

  const inserted = (await em.query(
    `INSERT INTO authors(name, slug) VALUES($1, $2) RETURNING id`,
    [safeName, slug]
  )) as Array<{ id: string }>;
  return inserted[0].id;
}

function wordCountFromText(text?: string): number {
  if (!text) return 0;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return 0;
  return normalized.split(" ").length;
}

async function upsertChapterBody(
  em: EntityManager,
  chapterId: string,
  novelId: string,
  content: string
) {
  await em.query(
    `
      INSERT INTO chapter_bodies(chapter_id, novel_id, content_html)
      VALUES($1, $2, $3)
      ON CONFLICT (chapter_id, novel_id) DO UPDATE
        SET content_html = EXCLUDED.content_html,
            updated_at = now()
    `,
    [chapterId, novelId, content]
  );
}

/**
 * Upsert Series (Novel) + map nguồn ngoài
 * - Tạo/tìm author
 * - Tạo/tìm novel qua slug hoặc map
 * - Cập nhật title/author nếu đã tồn tại
 * - Gắn mapping (source_id, ext_series_id) -> series_id
 */
export async function upsertSeries(
  ds: DataSource,
  p: {
    title: string;
    authorName?: string;
    coverUrl?: string | null;
    sourceId: string;
    extSeriesId: string;
    url: string;
  }
): Promise<{ seriesId: string }> {
  if (!p.url) throw new Error("Series URL is required");
  await ensureCrawlSchema(ds);
  const em = ds.createEntityManager();
  const authorId = await ensureAuthor(em, p.authorName);

  // 2) Tìm series qua mapping nguồn
  const mapped = (await em.query(
    `
    SELECT n.id AS "seriesId"
    FROM series_source_map m
    JOIN novels n ON n.id = m.series_id
    WHERE m.source_id = $1 AND m.ext_series_id = $2
    LIMIT 1
  `,
    [p.sourceId, p.extSeriesId]
  )) as Array<{ seriesId: string }>;

  let seriesId: string | undefined = mapped?.[0]?.seriesId;

  // Slug từ title
  const baseSlug =
    slugifySafe(p.title) ||
    fallbackSlug(p.extSeriesId || "series", "series").toLowerCase();
  let slug = baseSlug;

  if (!seriesId) {
    for (let i = 2; ; i++) {
      const existing = (await em.query(
        `SELECT id, source FROM novels WHERE slug = $1 LIMIT 1`,
        [slug]
      )) as Array<{ id: string; source: string }>;
      if (!existing[0]) break;
      if (existing[0].source === "crawler") {
        seriesId = existing[0].id;
        break;
      }
      slug = `${baseSlug}-${i}`;
      if (i > 200) throw new Error("Cannot generate unique novel slug");
    }
  } else {
    const row = (await em.query(
      `SELECT slug FROM novels WHERE id = $1`,
      [seriesId]
    )) as Array<{ slug: string }>;
    slug = row[0]?.slug ?? slug;
  }

  if (!seriesId) {
    // 3) Tạo mới
    const r = (await em.query(
      `
      INSERT INTO novels(title, slug, author_id, source, source_url)
      VALUES($1, $2, $3, 'crawler', $4)
      RETURNING id
    `,
      [p.title, slug, authorId, p.url]
    )) as Array<{ id: string }>;
    seriesId = r[0].id;

    // 4) Lưu mapping nguồn
    await em.query(
      `
      INSERT INTO series_source_map(source_id, ext_series_id, series_id, ext_url)
      VALUES($1, $2, $3, $4)
      ON CONFLICT (source_id, ext_series_id) DO NOTHING
    `,
      [p.sourceId, p.extSeriesId, seriesId, p.url || ""]
    );
  } else {
    // 5) Đã có -> cập nhật thông tin cơ bản
    await em.query(
      `UPDATE novels
       SET title=$1,
           author_id=$2,
           source='crawler',
           source_url=$3,
           updated_at=now()
       WHERE id=$4`,
      [p.title, authorId, p.url, seriesId]
    );
    // Đảm bảo có mapping (phòng khi dữ liệu cũ thiếu)
    await em.query(
      `
      INSERT INTO series_source_map(source_id, ext_series_id, series_id, ext_url)
      VALUES($1, $2, $3, $4)
      ON CONFLICT (source_id, ext_series_id) DO UPDATE SET
        series_id = EXCLUDED.series_id,
        ext_url   = EXCLUDED.ext_url
    `,
      [p.sourceId, p.extSeriesId, seriesId, p.url || ""]
    );
  }

  return { seriesId: seriesId! };
}

/**
 * Upsert Chapter + map nguồn ngoài
 * - Tạo mới chapter nếu chưa có map (auto index_no nếu thiếu)
 * - Cập nhật title/word_count/content nếu đã có
 */
export async function upsertChapter(
  ds: DataSource,
  p: {
    sourceId: string;
    extChapterId: string;
    seriesId: string;
    indexNo?: number;
    title?: string | null;
    content: string;
    extUrl: string;
  }
): Promise<{ chapterId: string }> {
  if (!p.extUrl) throw new Error("Chapter URL is required");
  await ensureCrawlSchema(ds);
  const em = ds.createEntityManager();

  // 1) Tìm chapter qua mapping
  const mapped = (await em.query(
    `
    SELECT c.id AS "chapterId"
    FROM chapter_source_map m
    JOIN chapters c ON c.id = m.chapter_id
    WHERE m.source_id=$1 AND m.ext_chapter_id=$2
    LIMIT 1
  `,
    [p.sourceId, p.extChapterId]
  )) as Array<{ chapterId: string }>;

  const wordCount = wordCountFromText(p.content);
  const title = p.title?.trim() || null;
  const novelId = p.seriesId;

  let chapterId: string;

  if (!mapped?.[0]?.chapterId) {
    // 2) Chưa có -> insert mới (tự tính index_no nếu thiếu)
    let indexNo = Number.isFinite(p.indexNo) ? Number(p.indexNo) : undefined;
    if (!indexNo || indexNo <= 0) {
      const next = (await em.query(
        `SELECT COALESCE(MAX(index_no), 0)::int + 1 AS next
         FROM chapters
         WHERE novel_id = $1`,
        [novelId]
      )) as Array<{ next: number | string }>;
      indexNo = Number(next[0]?.next ?? 1);
    }

    const dup = (await em.query(
      `SELECT id FROM chapters WHERE novel_id=$1 AND index_no=$2 LIMIT 1`,
      [novelId, indexNo]
    )) as Array<{ id: string }>;

    const persistedTitle = title ?? `Chapter ${indexNo}`;

    if (dup[0]?.id) {
      chapterId = dup[0].id;
      await em.query(
        `
        UPDATE chapters
        SET title = COALESCE($1, title),
            words_count = $2,
            updated_at = now()
        WHERE id = $3
      `,
        [title ?? persistedTitle, wordCount, chapterId]
      );
    } else {
      const inserted = (await em.query(
        `
        INSERT INTO chapters(novel_id, index_no, title, words_count, slug)
        VALUES($1, $2, $3, $4, NULL)
        RETURNING id
      `,
        [novelId, indexNo, persistedTitle, wordCount]
      )) as Array<{ id: string }>;
      chapterId = inserted[0].id;
    }

    await em.query(
      `
      INSERT INTO chapter_source_map(source_id, ext_chapter_id, chapter_id, ext_url)
      VALUES($1, $2, $3, $4)
      ON CONFLICT (source_id, ext_chapter_id) DO UPDATE SET
        chapter_id = EXCLUDED.chapter_id,
        ext_url    = EXCLUDED.ext_url
    `,
      [p.sourceId, p.extChapterId, chapterId, p.extUrl]
    );
  } else {
    // 3) Có rồi -> cập nhật nội dung
    chapterId = mapped[0].chapterId as string;
    await em.query(
      `
      UPDATE chapters
      SET title = COALESCE($1, title),
          index_no = COALESCE($2, index_no),
          words_count = $3,
          updated_at = now()
      WHERE id=$4
    `,
      [title, p.indexNo ?? null, wordCount, chapterId]
    );

    // Bổ sung ext_url nếu trước đó rỗng
    await em.query(
      `
      UPDATE chapter_source_map
      SET ext_url = $1,
          chapter_id = $2
      WHERE source_id=$3 AND ext_chapter_id=$4
    `,
      [p.extUrl, chapterId, p.sourceId, p.extChapterId]
    );
  }

  await upsertChapterBody(em, chapterId, novelId, p.content);

  return { chapterId };
}
