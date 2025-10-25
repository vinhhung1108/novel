import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { NovelsService } from "@/novels/novels.service";
import { ChaptersService } from "@/modules/chapters/chapters.service";
import { SourceMapsService } from "./source-maps.service";
import { DataSource } from "typeorm";
import { Chapter } from "@/entities/chapter.entity";

export type NovelDTO = {
  source_id: string; // 'truyenchuhay' | 'truyenfull'
  ext_series_id: string;
  url?: string | null;
  title: string;
  slug: string;
  description?: string | null;
  cover_image_key?: string | null;
  status?: "ongoing" | "completed" | "hiatus";
  author_id?: string | null;
  original_title?: string | null;
  alt_titles?: string[] | null;
  language_code?: string | null;
  is_featured?: boolean;
  mature?: boolean;
  priority?: number;
};

export type ChapterDTO = {
  source_id: string;
  ext_chapter_id: string;
  novel_ext_series_id?: string; // optional khi worker truyền song song
  novel_id?: string | null; // nếu đã có novel_id thì ưu tiên
  index_no: number;
  title: string;
  url?: string | null;
  published_at?: Date | null;
  content_html: string;
};

@Injectable()
export class CrawlerPersistService {
  private static readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  constructor(
    private readonly novels: NovelsService,
    private readonly chapters: ChaptersService,
    private readonly maps: SourceMapsService,
    @InjectDataSource() private readonly db: DataSource
  ) {}

  private async normalizeSourceId(identifier: string): Promise<string> {
    const raw = identifier?.trim();
    if (!raw) {
      throw new InternalServerErrorException("source_id is required");
    }

    if (CrawlerPersistService.UUID_RE.test(raw)) return raw;

    const lower = raw.toLowerCase();
    const like = `%${lower}%`;

    const rows: Array<{ id: string; name: string; base_url: string }> =
      await this.db.query(
        `
        SELECT id, name, base_url
        FROM source
        WHERE lower(name) = $1
           OR lower(base_url) = $1
           OR lower(base_url) LIKE $2
        ORDER BY created_at DESC
        LIMIT 5
      `,
        [lower, like]
      );

    const hostMatch = rows.find((row) => {
      try {
        const host = new URL(row.base_url).hostname.toLowerCase();
        return host === lower || host.includes(lower);
      } catch {
        return false;
      }
    });

    const match = hostMatch ?? rows[0];
    if (!match) {
      throw new InternalServerErrorException(
        `Cannot resolve source_id "${identifier}"`
      );
    }

    return match.id;
  }

  async upsertNovel(dto: NovelDTO) {
    const sourceId = await this.normalizeSourceId(dto.source_id);
    const payload: NovelDTO = { ...dto, source_id: sourceId };
    const novel = await this.novels.upsertFromCrawl(payload, this.maps);
    return { novel, source_id: sourceId };
  }

  async upsertChapter(dto: ChapterDTO & { novel_slug?: string }) {
    const sourceId = await this.normalizeSourceId(dto.source_id);
    let novelId = dto.novel_id;

    if (!novelId && dto.novel_ext_series_id) {
      novelId = await this.maps.findNovelIdBySeriesMap(
        sourceId,
        dto.novel_ext_series_id
      );
    }
    if (!novelId)
      throw new Error(
        "novel_id is required (or provide novel_ext_series_id mapped beforehand)"
      );

    const ch = await this.chapters.upsertFromCrawl({
      novel_id: novelId,
      index_no: dto.index_no,
      title: dto.title,
      content_html: dto.content_html,
      url: dto.url ?? null,
      published_at: dto.published_at ?? null,
      ext: { source_id: sourceId, ext_chapter_id: dto.ext_chapter_id },
    });

    // ghi map chương
    await this.maps.upsertChapterMap({
      source_id: sourceId,
      ext_chapter_id: dto.ext_chapter_id,
      novel_id: novelId,
      chapter_id: ch.id,
      index_no: dto.index_no,
      url: dto.url ?? null,
    });

    return { chapter: ch as Chapter, source_id: sourceId };
  }
}
