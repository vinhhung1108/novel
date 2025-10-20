import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

export interface OverviewRow {
  novels: number;
  chapters: number;
  authors: number;
  tags: number;
}

interface TopNovelRow {
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
  views: number | string | null;
  words_count: number | string | null;
  published_at: Date | string | null;
  updated_at: Date | string;
  sum_views: number | string | null;
}

@Injectable()
export class StatsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Tổng số thực thể */
  async overview() {
    const rows: OverviewRow[] = await this.db.query(`
      SELECT
        (SELECT COUNT(*) FROM public.novels)::int   AS novels,
        (SELECT COUNT(*) FROM public.chapters)::int AS chapters,
        (SELECT COUNT(*) FROM public.authors)::int  AS authors,
        (SELECT COUNT(*) FROM public.tags)::int     AS tags
    `);
    const first = rows[0];
    return first ?? { novels: 0, chapters: 0, authors: 0, tags: 0 };
  }

  /** Chuỗi thời gian views theo day|week trong khoảng range */
  async series(granularity: "day" | "week", range: number) {
    if (range <= 0 || range > 365)
      throw new BadRequestException("range invalid");

    if (granularity === "day") {
      const rows = await this.db.query(
        `
        WITH dates AS (
          SELECT generate_series(
            (current_date - ($1::int - 1))::date,
            current_date::date,
            interval '1 day'
          )::date AS d
        )
        SELECT d AS date, COALESCE(SUM(v.views), 0)::int AS views
        FROM dates
        LEFT JOIN public.novel_views v ON v.view_date = d
        GROUP BY d
        ORDER BY d ASC
        `,
        [range]
      );
      return { items: rows };
    }

    const rows = await this.db.query(
      `
      WITH weeks AS (
        SELECT generate_series(
          date_trunc('week', current_date)::date - (($1::int - 1) * 7),
          date_trunc('week', current_date)::date,
          interval '7 day'
        )::date AS w
      )
      SELECT w AS date, COALESCE(SUM(v.views), 0)::int AS views
      FROM weeks
      LEFT JOIN public.novel_views v
        ON date_trunc('week', v.view_date)::date = w
      GROUP BY w
      ORDER BY w ASC
      `,
      [range]
    );
    return { items: rows };
  }

  /** Top truyện theo lượt xem trong N ngày */
  async top(days = 7, limit = 10) {
    if (days <= 0 || days > 3650) throw new BadRequestException("days invalid");
    if (limit <= 0 || limit > 100)
      throw new BadRequestException("limit invalid");

    const rows: TopNovelRow[] = await this.db.query(
      `
      SELECT n.*, SUM(v.views)::int AS sum_views
      FROM public.novel_views v
      JOIN public.novels n ON n.id = v.novel_id
      WHERE v.view_date >= (current_date - $1::int)
      GROUP BY n.id
      ORDER BY sum_views DESC, n.updated_at DESC
      LIMIT $2::int
      `,
      [days, limit]
    );

    const items = rows.map((row) => ({
      novel: {
        id: row.id,
        title: row.title,
        slug: row.slug,
        description: row.description,
        cover_image_key: row.cover_image_key,
        status: row.status,
        source: row.source,
        source_url: row.source_url,
        author_id: row.author_id,
        rating_avg: Number(row.rating_avg ?? 0),
        rating_count: Number(row.rating_count ?? 0),
        views: String(row.views ?? "0"),
        words_count: String(row.words_count ?? "0"),
        published_at: row.published_at,
        updated_at: row.updated_at,
      },
      views: Number(row.sum_views ?? 0),
    }));

    return { items };
  }
}
