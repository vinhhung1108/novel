import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Chapter } from "@/entities/chapter.entity";
import { ChapterBody } from "@/entities/chapter-body.entity";
import { Novel } from "@/entities/novel.entity";
import { SearchService } from "@/search/search.service";
import { slugifySafe } from "@/common/utils/slug";
import { wordCountFromHtml } from "@/common/utils/text";
import type { UpdateChapterDto } from "./dto/update-chapter.dto";

@Injectable()
export class ChaptersService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(Chapter) private readonly chapters: Repository<Chapter>,
    @InjectRepository(ChapterBody)
    private readonly bodies: Repository<ChapterBody>,
    @InjectRepository(Novel) private readonly novels: Repository<Novel>,
    private readonly search: SearchService
  ) {}

  list(novel_id: string, page = 1, limit = 50) {
    return this.chapters.find({
      where: { novel_id },
      order: { index_no: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  get(novel_id: string, index_no: number) {
    return this.chapters.findOne({ where: { novel_id, index_no } });
  }

  async getWithBody(novel_id: string, index_no: number) {
    const ch = await this.get(novel_id, index_no);
    if (!ch) return null;
    const body = await this.bodies.findOne({ where: { chapter_id: ch.id } });
    return { chapter: ch, body };
  }

  async createLegacy(data: Partial<Chapter> & { content?: string }) {
    if (!data?.novel_id) throw new BadRequestException("novel_id is required");
    if (typeof data.index_no !== "number")
      throw new BadRequestException("index_no is required");
    if (!data?.title?.trim())
      throw new BadRequestException("title is required");

    const existed = await this.chapters.findOne({
      where: { novel_id: data.novel_id, index_no: data.index_no },
    });
    if (existed)
      throw new BadRequestException("index_no already exists for this novel");

    const words = wordCountFromHtml(data.content || "");
    const ch = await this.chapters.save({
      novel_id: data.novel_id,
      index_no: data.index_no,
      title: data.title.trim(),
      slug: data.slug ?? null,
      checksum: data.checksum ?? null,
      words_count: words,
      published_at: data.published_at ?? null,
    });

    await this.db.query(
      `INSERT INTO public.chapter_bodies (chapter_id, novel_id, content_html)
       VALUES ($1, $2, $3)
       ON CONFLICT (chapter_id, novel_id) DO UPDATE
         SET content_html = EXCLUDED.content_html, updated_at = now()`,
      [ch.id, ch.novel_id, data.content ?? ""]
    );

    this.search.chapters
      .addDocuments([
        {
          id: ch.id,
          novel_id: ch.novel_id,
          index_no: ch.index_no,
          title: ch.title,
        },
      ])
      .catch(() => {});
    return ch;
  }

  async createAuto(
    novel_id: string,
    payload: { title: string; content?: string; slug?: string | null }
  ) {
    if (!novel_id) throw new BadRequestException("novel_id is required");
    if (!payload?.title?.trim())
      throw new BadRequestException("title is required");

    const novel = await this.novels.findOne({ where: { id: novel_id } });
    if (!novel) throw new NotFoundException("Novel not found");

    const words = wordCountFromHtml(payload.content || "");

    const saved = await this.db.transaction(async (trx) => {
      const row = await trx.query(
        `SELECT COALESCE(MAX(index_no), 0)::int AS max FROM public.chapters WHERE novel_id = $1`,
        [novel_id]
      );
      const nextIndex = (row?.[0]?.max ?? 0) + 1;

      const ch = trx.create(Chapter, {
        novel_id,
        index_no: nextIndex,
        title: payload.title.trim(),
        slug: payload.slug ? slugifySafe(payload.slug) : null,
        words_count: words,
      });
      const created = await trx.save(Chapter, ch);

      await trx.query(
        `INSERT INTO public.chapter_bodies (chapter_id, novel_id, content_html)
         VALUES ($1, $2, $3)
         ON CONFLICT (chapter_id, novel_id) DO UPDATE
           SET content_html = EXCLUDED.content_html, updated_at = now()`,
        [created.id, novel_id, payload.content || ""]
      );

      return created;
    });

    this.search.chapters
      .addDocuments([
        {
          id: saved.id,
          novel_id: saved.novel_id,
          index_no: saved.index_no,
          title: saved.title,
        },
      ])
      .catch(() => {});
    return saved;
  }

  async patch(
    novel_id: string,
    index_no: number,
    body: UpdateChapterDto & { published_at?: Chapter["published_at"] }
  ) {
    const ch = await this.get(novel_id, index_no);
    if (!ch) throw new NotFoundException("Chapter not found");

    if (typeof body.index_no === "number" && body.index_no !== ch.index_no) {
      const dup = await this.chapters.findOne({
        where: { novel_id, index_no: body.index_no },
      });
      if (dup)
        throw new BadRequestException("index_no already exists for this novel");
    }

    const patch: Partial<Chapter> = {
      title:
        typeof body.title === "string"
          ? body.title.trim() || ch.title
          : undefined,
      slug: typeof body.slug === "string" ? slugifySafe(body.slug) : undefined,
      index_no: typeof body.index_no === "number" ? body.index_no : undefined,
      published_at: body.published_at ?? undefined,
      updated_at: new Date(),
    };

    if (typeof body.content === "string") {
      patch.words_count = wordCountFromHtml(body.content);
      await this.db.query(
        `INSERT INTO public.chapter_bodies (chapter_id, novel_id, content_html)
         VALUES ($1, $2, $3)
         ON CONFLICT (chapter_id, novel_id) DO UPDATE
           SET content_html = EXCLUDED.content_html, updated_at = now()`,
        [ch.id, ch.novel_id, body.content]
      );
    }

    await this.chapters.update({ id: ch.id }, patch);
    const updated = await this.chapters.findOne({ where: { id: ch.id } });

    if (updated) {
      this.search.chapters
        .addDocuments([
          {
            id: updated.id,
            novel_id: updated.novel_id,
            index_no: updated.index_no,
            title: updated.title,
          },
        ])
        .catch(() => {});
    }
    return updated ?? null;
  }

  async deleteOne(novel_id: string, index_no: number) {
    const ch = await this.get(novel_id, index_no);
    if (!ch) throw new NotFoundException("Chapter not found");
    await this.db.transaction(async (trx) => {
      await trx.delete(ChapterBody, { chapter_id: ch.id, novel_id });
      await trx.delete(Chapter, { id: ch.id });
    });
    this.search.chapters.deleteDocuments([ch.id]).catch(() => {});
    return { ok: true };
  }

  async bulkDelete(novel_id: string, index_list: number[]) {
    if (!Array.isArray(index_list) || index_list.length === 0)
      throw new BadRequestException("index_list required");

    const chapters = await this.chapters.find({
      where: index_list.map((idx) => ({ novel_id, index_no: idx })),
      select: { id: true, index_no: true, novel_id: true },
    });
    if (chapters.length === 0) return { ok: true, deleted: 0 };

    const ids = chapters.map((c) => c.id);
    await this.db.transaction(async (trx) => {
      await trx.delete(ChapterBody, { novel_id });
      // Xoá body theo từng chapter id để an toàn:
      if (ids.length) {
        await trx
          .createQueryBuilder()
          .delete()
          .from(ChapterBody)
          .where("chapter_id IN (:...ids)", { ids })
          .execute();
      }
      await trx.delete(Chapter, { id: ids as any });
    });
    this.search.chapters.deleteDocuments(ids).catch(() => {});
    return { ok: true, deleted: ids.length };
  }

  async getNextIndex(novel_id: string) {
    const rows = await this.db.query(
      `SELECT COALESCE(MAX(index_no), 0)::int AS max FROM public.chapters WHERE novel_id = $1`,
      [novel_id]
    );
    return (rows?.[0]?.max ?? 0) + 1;
  }
}
