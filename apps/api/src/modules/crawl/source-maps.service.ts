import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class SourceMapsService {
  constructor(private readonly db: DataSource) {}

  async upsertSeriesMap(input: {
    source_id: string; // ví dụ: 'truyenchuhay' | 'truyenfull'
    ext_series_id: string; // slug/id ngoài
    novel_id: string;
    url?: string | null;
  }) {
    const { source_id, ext_series_id, novel_id, url } = input;
    await this.db.query(
      `INSERT INTO public.series_source_map (source_id, ext_series_id, novel_id, url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source_id, ext_series_id) DO UPDATE
       SET novel_id = EXCLUDED.novel_id, url = EXCLUDED.url, updated_at = now()`,
      [source_id, ext_series_id, novel_id, url ?? null]
    );
  }

  async upsertChapterMap(input: {
    source_id: string;
    ext_chapter_id: string; // id ngoài (vd. đường dẫn chương)
    novel_id: string;
    chapter_id: string;
    index_no: number;
    url?: string | null;
  }) {
    const { source_id, ext_chapter_id, novel_id, chapter_id, index_no, url } =
      input;
    await this.db.query(
      `INSERT INTO public.chapter_source_map (source_id, ext_chapter_id, novel_id, chapter_id, index_no, url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (source_id, ext_chapter_id) DO UPDATE
       SET novel_id = EXCLUDED.novel_id,
           chapter_id = EXCLUDED.chapter_id,
           index_no = EXCLUDED.index_no,
           url = EXCLUDED.url,
           updated_at = now()`,
      [source_id, ext_chapter_id, novel_id, chapter_id, index_no, url ?? null]
    );
  }

  async findNovelIdBySeriesMap(
    source_id: string,
    ext_series_id: string
  ): Promise<string | null> {
    const rows = await this.db.query(
      `SELECT novel_id FROM public.series_source_map WHERE source_id=$1 AND ext_series_id=$2 LIMIT 1`,
      [source_id, ext_series_id]
    );
    return rows?.[0]?.novel_id ?? null;
  }
}
