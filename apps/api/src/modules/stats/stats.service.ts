import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@Injectable()
export class StatsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Tổng số thực thể */
  async overview() {
    const rows = await this.db.query(`
      SELECT
        (SELECT COUNT(*) FROM public.novels)::int   AS novels,
        (SELECT COUNT(*) FROM public.chapters)::int AS chapters,
        (SELECT COUNT(*) FROM public.authors)::int  AS authors,
        (SELECT COUNT(*) FROM public.tags)::int     AS tags
    `);
    return rows[0] ?? { novels: 0, chapters: 0, authors: 0, tags: 0 };
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

    const rows = await this.db.query(
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

    const items = rows.map((r: any) => ({
      novel: {
        id: r.id,
        title: r.title,
        slug: r.slug,
        description: r.description,
        cover_image_key: r.cover_image_key,
        status: r.status,
        source: r.source,
        source_url: r.source_url,
        author_id: r.author_id,
        rating_avg: Number(r.rating_avg || 0),
        rating_count: Number(r.rating_count || 0),
        views: String(r.views ?? "0"),
        words_count: String(r.words_count ?? "0"),
        published_at: r.published_at,
        updated_at: r.updated_at,
      },
      views: Number(r.sum_views || 0),
    }));

    return { items };
  }
}
