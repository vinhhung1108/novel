import { Injectable } from "@nestjs/common";
import { NovelsService } from "@/novels/novels.service";
import { ChaptersService } from "@/modules/chapters/chapters.service";
import { SourceMapsService } from "./source-maps.service";

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
  constructor(
    private readonly novels: NovelsService,
    private readonly chapters: ChaptersService,
    private readonly maps: SourceMapsService
  ) {}

  async upsertNovel(dto: NovelDTO) {
    const novel = await this.novels.upsertFromCrawl(dto, this.maps);
    return novel;
  }

  async upsertChapter(dto: ChapterDTO & { novel_slug?: string }) {
    let novelId = dto.novel_id;

    if (!novelId && dto.novel_ext_series_id) {
      novelId = await this.maps.findNovelIdBySeriesMap(
        dto.source_id,
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
      ext: { source_id: dto.source_id, ext_chapter_id: dto.ext_chapter_id },
    });

    // ghi map chương
    await this.maps.upsertChapterMap({
      source_id: dto.source_id,
      ext_chapter_id: dto.ext_chapter_id,
      novel_id: novelId,
      chapter_id: ch.id,
      index_no: dto.index_no,
      url: dto.url ?? null,
    });

    return ch;
  }
}
