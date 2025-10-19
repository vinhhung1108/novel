import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, ILike, Repository } from "typeorm";
import { Novel } from "../../entities/novel.entity";
import { Chapter } from "../../entities/chapter.entity";
import { ChapterBody } from "../../entities/chapter-body.entity";
import { NovelView } from "../../entities/novel-view.entity";
import { slugifySafe, isValidSlug } from "../../common/utils/slug";
import { SearchService } from "../../search/search.service";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";

@Injectable()
export class NovelsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(Novel) private readonly novels: Repository<Novel>,
    @InjectRepository(Chapter) private readonly chapters: Repository<Chapter>,
    @InjectRepository(ChapterBody)
    private readonly bodies: Repository<ChapterBody>,
    @InjectRepository(NovelView) private readonly views: Repository<NovelView>,
    private readonly search: SearchService
  ) {}

  async list(qs: PaginationQueryDto) {
    const { page = 1, limit = 20, q, sort = "updated_at", order = "DESC" } = qs;
    const where = q
      ? [{ title: ILike(`%${q}%`) }, { slug: ILike(`%${q}%`) }]
      : undefined;

    const [items, total] = await this.novels.findAndCount({
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        cover_image_key: true,
        updated_at: true,
        status: true,
        words_count: true,
        views: true,
      },
      where,
      order: { [sort]: order as any, id: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  getBySlug(slug: string) {
    return this.novels.findOne({ where: { slug } });
  }

  async slugExists(slug: string) {
    if (!slug || !isValidSlug(slug)) return { exists: false, valid: false };
    const found = await this.novels.findOne({ where: { slug } });
    return { exists: !!found, valid: true };
  }

  async create(data: Partial<Novel>) {
    if (!data?.title?.trim())
      throw new BadRequestException("Title is required");
    const base = data.slug?.trim() ? data.slug : data.title!;
    const baseSlug = slugifySafe(base);
    if (!baseSlug) throw new BadRequestException("Cannot generate slug");

    let unique = baseSlug;
    for (let i = 2; ; i++) {
      const existed = await this.novels.findOne({ where: { slug: unique } });
      if (!existed) break;
      unique = `${baseSlug}-${i}`;
      if (i > 200) throw new BadRequestException("Slug overflow");
    }

    const novel = await this.novels.save({
      title: data.title!.trim(),
      slug: unique,
      description: data.description ?? "",
      cover_image_key: data.cover_image_key ?? null,
      status: (data.status as any) || "ongoing",
      source: data.source || "local",
      source_url: data.source_url || null,
      author_id: data.author_id || null,
      rating_avg: 0,
      rating_count: 0,
      words_count: "0",
      views: "0",
      published_at: data.published_at || null,

      // extra fields nếu có
      original_title: data.original_title ?? null,
      alt_titles: data.alt_titles ?? null,
      language_code: data.language_code ?? null,
      is_featured: data.is_featured ?? false,
      mature: data.mature ?? false,
      priority: data.priority ?? 0,
    });

    this.search.novels
      .addDocuments([{ id: novel.id, title: novel.title, slug: novel.slug }])
      .catch(() => {});
    return novel;
  }

  async update(id: string, data: Partial<Novel>) {
    const novel = await this.novels.findOne({ where: { id } });
    if (!novel) throw new NotFoundException("Novel not found");

    const patch: Partial<Novel> = { updated_at: new Date() };
    if (typeof data.title === "string") patch.title = data.title.trim();
    if (typeof data.description === "string")
      patch.description = data.description;
    if (typeof data.cover_image_key === "string")
      patch.cover_image_key = data.cover_image_key;
    if (typeof data.status === "string") patch.status = data.status as any;
    if (typeof data.source === "string") patch.source = data.source;
    if (typeof data.source_url === "string") patch.source_url = data.source_url;
    if (typeof data.author_id === "string") patch.author_id = data.author_id;
    if (data.published_at !== undefined) patch.published_at = data.published_at;

    // extra
    if (data.original_title !== undefined)
      patch.original_title = data.original_title;
    if (data.alt_titles !== undefined)
      patch.alt_titles = data.alt_titles as any;
    if (data.language_code !== undefined)
      patch.language_code = data.language_code;
    if (data.is_featured !== undefined) patch.is_featured = !!data.is_featured;
    if (data.mature !== undefined) patch.mature = !!data.mature;
    if (data.priority !== undefined)
      patch.priority = Number(data.priority || 0);

    if (typeof data.slug === "string") {
      const next = slugifySafe(data.slug);
      if (!next) throw new BadRequestException("Slug is invalid");
      if (next !== novel.slug) {
        const existed = await this.novels.findOne({ where: { slug: next } });
        if (existed && existed.id !== id)
          throw new BadRequestException("Slug already exists");
        patch.slug = next;
      }
    }

    await this.novels.update({ id }, patch);
    const updated = await this.novels.findOne({ where: { id } });

    if (updated) {
      this.search.novels
        .addDocuments([{ id, title: updated.title, slug: updated.slug }])
        .catch(() => {});
    }
    return updated ?? null;
  }

  /** Xoá truyện (kèm chương & body) trong transaction */
  async delete(id: string) {
    await this.db.transaction(async (trx) => {
      const novel = await trx.findOne(Novel, { where: { id } });
      if (!novel) throw new NotFoundException("Novel not found");

      const chapters = await trx.find(Chapter, {
        where: { novel_id: id },
        select: { id: true },
      });
      const chapterIds = chapters.map((c) => c.id);
      if (chapterIds.length) {
        await trx.delete(ChapterBody, { novel_id: id });
        await trx.delete(Chapter, { novel_id: id });
      }
      await trx.delete(NovelView, { novel_id: id });
      await trx.delete(Novel, { id });

      // best-effort xoá khỏi Meili
      this.search.chapters.deleteDocuments(chapterIds).catch(() => {});
      this.search.novels.deleteDocuments([id]).catch(() => {});
    });
    return { ok: true };
  }

  /** Tăng view theo ngày (partitioned table đã có unique (novel_id, view_date)) */
  async addView(novel_id: string) {
    const today = new Date();
    const ymd = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    )
      .toISOString()
      .slice(0, 10);
    await this.db.query(
      `INSERT INTO public.novel_views (novel_id, view_date, views)
       VALUES ($1::uuid, $2::date, 1)
       ON CONFLICT (novel_id, view_date)
       DO UPDATE SET views = public.novel_views.views + 1`,
      [novel_id, ymd]
    );
    return { ok: true };
  }
}
