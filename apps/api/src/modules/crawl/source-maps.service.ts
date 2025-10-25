import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@Injectable()
export class SourceMapsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  // ✅ Đúng: tìm novel_id theo (source_id, ext_series_id)
  async findNovelIdBySeriesMap(
    source_id: string,
    ext_series_id: string
  ): Promise<string | null> {
    const rows = await this.db.query(
      `SELECT novel_id
         FROM public.series_source_map
        WHERE source_id = $1 AND ext_series_id = $2
        LIMIT 1`,
      [source_id, ext_series_id]
    );
    return rows?.[0]?.novel_id ?? null;
  }

  async upsertSeriesMap(params: {
    source_id: string;
    ext_series_id: string;
    novel_id: string;
    url?: string | null;
  }) {
    const { source_id, ext_series_id, novel_id, url } = params;
    await this.db.query(
      `INSERT INTO public.series_source_map (source_id, ext_series_id, novel_id, url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source_id, ext_series_id) DO UPDATE
         SET novel_id = EXCLUDED.novel_id,
             url      = COALESCE(EXCLUDED.url, public.series_source_map.url),
             updated_at = now()`,
      [source_id, ext_series_id, novel_id, url ?? null]
    );
  }

  async upsertChapterMap(params: {
    source_id: string;
    ext_chapter_id: string;
    novel_id: string;
    index_no: number;
    chapter_id: string;
    url?: string | null;
  }) {
    const {
      source_id,
      ext_chapter_id,
      novel_id,
      index_no,
      chapter_id,
      url,
    } = params;
    const extUrl = url ?? ext_chapter_id;
    await this.db.query(
      `INSERT INTO public.chapter_source_map (source_id, ext_chapter_id, novel_id, index_no, chapter_id, ext_url, url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (source_id, ext_chapter_id) DO UPDATE
         SET novel_id  = EXCLUDED.novel_id,
             index_no  = EXCLUDED.index_no,
             chapter_id= EXCLUDED.chapter_id,
             ext_url   = COALESCE(EXCLUDED.ext_url, public.chapter_source_map.ext_url),
             url       = COALESCE(EXCLUDED.url, public.chapter_source_map.url),
             updated_at= now()`,
      [
        source_id,
        ext_chapter_id,
        novel_id,
        index_no,
        chapter_id,
        extUrl,
        url ?? null,
      ]
    );
  }
}
