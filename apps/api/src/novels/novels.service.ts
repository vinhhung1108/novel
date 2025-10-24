import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Novel } from "../entities/novel.entity";
import { StorageService } from "@/upload/storage.service";
import { CreateNovelDto } from "./dto/create-novel.dto";
import { QueryFailedError } from "typeorm";
import { SourceMapsService } from "@/modules/crawl/source-maps.service";

/** slugify an toàn (chuyển đ/Đ → d, bỏ dấu, giữ a-z0-9-) */
function slugifySafe(input: string): string {
  if (!input) return "";
  return input
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type UpdateNovelInput = Partial<CreateNovelDto>;

interface SummarySource {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  cover_image_key?: string | null;
  status?: string | null;
  words_count?: string | number;
  views?: string | number;
  author_id?: string | null;
  updated_at: Date;
}

interface DetailSource extends SummarySource {
  category_ids?: string[];
  tag_ids?: string[];
}

export interface NovelListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_key: string | null;
  updated_at: Date;
  status: string | null;
  words_count: string | number;
  views: string | number;
  author_id: string | null;
}

export interface NovelWithRelations extends Novel {
  category_ids: string[];
  tag_ids: string[];
}

export interface NovelSummaryResponse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_key: string | null;
  status: string | null;
  words_count: string | number;
  views: string | number;
  author_id: string | null;
  updated_at: string;
}

export interface NovelDetailResponse extends NovelSummaryResponse {
  category_ids: string[];
  tag_ids: string[];
}

export interface NovelListResponse {
  items: NovelSummaryResponse[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class NovelsService implements OnModuleInit {
  private readonly logger = new Logger(NovelsService.name);
  constructor(
    @InjectRepository(Novel)
    private readonly novels: Repository<Novel>,
    private readonly db: DataSource,
    private readonly storage: StorageService
  ) {}

  async onModuleInit() {
    await this.ensureIndexes();
  }

  async replaceNovelCategories(
    novel_id: string,
    category_ids: string[]
  ): Promise<{ ok: true }> {
    // xác nhận novel tồn tại
    const novel = await this.novels.findOne({ where: { id: novel_id } });
    if (!novel) throw new NotFoundException("Novel not found");

    // thay thế toàn bộ
    await this.db.transaction(async (trx) => {
      await trx.query(
        `DELETE FROM public.novel_categories WHERE novel_id = $1`,
        [novel_id]
      );
      if (Array.isArray(category_ids) && category_ids.length) {
        const values = category_ids.map((_, i) => `($1, $${i + 2})`).join(", ");
        await trx.query(
          `INSERT INTO public.novel_categories (novel_id, category_id) VALUES ${values}`,
          [novel_id, ...category_ids]
        );
      }
    });
    return { ok: true };
  }

  async replaceNovelTags(
    novel_id: string,
    tag_ids: string[]
  ): Promise<{ ok: true }> {
    // Bảng nối tags của bạn đang dùng là gì? (trước đây có NovelTag entity).
    // Ví dụ join-table tên public.novel_tags(novel_id, tag_id):
    await this.db.transaction(async (trx) => {
      await trx.query(`DELETE FROM public.novel_tags WHERE novel_id = $1`, [
        novel_id,
      ]);
      if (Array.isArray(tag_ids) && tag_ids.length) {
        const values = tag_ids.map((_, i) => `($1, $${i + 2})`).join(", ");
        await trx.query(
          `INSERT INTO public.novel_tags (novel_id, tag_id) VALUES ${values}`,
          [novel_id, ...tag_ids]
        );
      }
    });
    return { ok: true };
  }

  async list(
    page = 1,
    limit = 12,
    opts?: { q?: string; sort?: "updated_at" | "title"; order?: "ASC" | "DESC" }
  ): Promise<NovelListResponse> {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit)
      ? Math.min(Math.max(limit, 1), 48)
      : 12;
    const sort = opts?.sort === "title" ? "title" : "updated_at";
    const order: "ASC" | "DESC" = opts?.order === "ASC" ? "ASC" : "DESC";
    const keyword = opts?.q?.trim().toLowerCase();

    const qb = this.novels
      .createQueryBuilder("novel")
      .select([
        "novel.id",
        "novel.title",
        "novel.slug",
        "novel.description",
        "novel.cover_image_key",
        "novel.updated_at",
        "novel.status",
        "novel.words_count",
        "novel.views",
        "novel.author_id",
      ])
      .orderBy(`novel.${sort}`, order)
      .addOrderBy("novel.id", "ASC")
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    if (keyword) {
      qb.where("LOWER(novel.title) LIKE :kw OR LOWER(novel.slug) LIKE :kw", {
        kw: `%${keyword}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((item) => this.mapToSummary(item as SummarySource)),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async getBySlug(slug: string): Promise<NovelDetailResponse | null> {
    const novel = await this.novels.findOne({ where: { slug } });
    if (!novel) return null;

    const categoryRows: { category_id: string }[] = await this.db.query(
      `SELECT category_id FROM public.novel_categories WHERE novel_id = $1`,
      [novel.id]
    );

    const tagRows: { tag_id: string }[] = await this.db.query(
      `SELECT tag_id FROM public.novel_tags WHERE novel_id = $1`,
      [novel.id]
    );

    return this.mapToDetail({
      id: novel.id,
      title: novel.title,
      slug: novel.slug,
      description: novel.description,
      cover_image_key: novel.cover_image_key,
      status: novel.status,
      words_count: novel.words_count,
      views: novel.views,
      author_id: novel.author_id,
      updated_at: novel.updated_at,
      category_ids: categoryRows.map((row) => row.category_id),
      tag_ids: tagRows.map((row) => row.tag_id),
    });
  }

  async slugExists(slug: string) {
    const s = slugifySafe(slug || "");
    if (!s || s !== slug) {
      return { exists: false, valid: false };
    }
    const found = await this.novels.findOne({ where: { slug: s } });
    return { exists: !!found, valid: true };
  }

  async create(data: CreateNovelDto): Promise<NovelDetailResponse> {
    if (!data?.title?.trim()) {
      throw new BadRequestException("Title is required");
    }

    // chuẩn hoá input
    const title = data.title.trim();
    const base = data.slug?.trim() || title;
    const baseSlug = slugifySafe(base);
    if (!baseSlug) throw new BadRequestException("Cannot generate slug");

    // ensure unique slug
    let unique = baseSlug;
    for (let suffix = 2; ; suffix++) {
      const existed = await this.novels.findOne({ where: { slug: unique } });
      if (!existed) break;
      unique = `${baseSlug}-${suffix}`;
      if (suffix > 200) throw new BadRequestException("Slug overflow");
    }

    const entity: Partial<Novel> = {
      title,
      slug: unique,
      description: data.description ?? "",
      cover_image_key: data.cover_image_key ?? null,
      status: data.status ?? "ongoing",
      source: data.source ?? "local",
      source_url: data.source_url ?? null,
      author_id: data.author_id ?? null,
      rating_avg: 0,
      rating_count: 0,
      words_count: "0",
      views: "0",
      published_at: parseDateInput(data.published_at),

      original_title: data.original_title ?? null,
      alt_titles: Array.isArray(data.alt_titles) ? data.alt_titles : null,
      language_code: data.language_code ?? null,
      is_featured: !!data.is_featured,
      mature: !!data.mature,
      priority: typeof data.priority === "number" ? data.priority : 0,
    };

    try {
      const saved = await this.novels.save(entity);
      const detail = await this.getBySlug(saved.slug);
      if (detail) return detail;
      return this.mapToDetail({
        id: saved.id,
        title: saved.title,
        slug: saved.slug,
        description: saved.description,
        cover_image_key: saved.cover_image_key,
        status: saved.status,
        words_count: saved.words_count,
        views: saved.views,
        author_id: saved.author_id,
        updated_at: saved.updated_at,
        category_ids: [],
        tag_ids: [],
      });
    } catch (e) {
      // Convert lỗi DB → 400 dễ hiểu
      if (e instanceof QueryFailedError) {
        const msg = String(e.driverError?.detail || e.message || "");
        if (msg.includes("already exists") || msg.includes("duplicate")) {
          throw new BadRequestException("Slug already exists");
        }
      }
      throw e;
    }
  }

  async update(
    id: string,
    data: UpdateNovelInput
  ): Promise<NovelDetailResponse | null> {
    const novel = await this.novels.findOne({ where: { id } });
    if (!novel) throw new NotFoundException("Novel not found");

    const patch: Partial<Novel> = { updated_at: new Date() };

    if (typeof data.title === "string") patch.title = data.title.trim();
    if (typeof data.description === "string")
      patch.description = data.description;
    if (typeof data.cover_image_key === "string")
      patch.cover_image_key = data.cover_image_key;
    if (data.status) patch.status = data.status;
    if (data.source) patch.source = data.source;
    if ("source_url" in data) patch.source_url = data.source_url ?? null;
    if ("author_id" in data) patch.author_id = data.author_id ?? null;
    if ("published_at" in data)
      patch.published_at = parseDateInput(data.published_at);

    // update slug nếu gửi lên
    if (typeof data.slug === "string") {
      const next = slugifySafe(data.slug);
      if (!next) throw new BadRequestException("Slug is invalid");
      if (next !== novel.slug) {
        const existed = await this.novels.findOne({ where: { slug: next } });
        if (existed && existed.id !== id) {
          throw new BadRequestException("Slug already exists");
        }
        patch.slug = next;
      }
    }

    // extra fields
    if ("original_title" in data)
      patch.original_title = data.original_title ?? null;
    if ("alt_titles" in data) {
      patch.alt_titles = Array.isArray(data.alt_titles)
        ? data.alt_titles
        : null;
    }
    if ("language_code" in data)
      patch.language_code = data.language_code ?? null;
    if ("is_featured" in data) patch.is_featured = !!data.is_featured;
    if ("mature" in data) patch.mature = !!data.mature;
    if ("priority" in data) {
      const pr = data.priority;
      patch.priority = typeof pr === "number" ? pr : 0;
    }

    await this.novels.update({ id }, patch);
    const nextSlug = patch.slug ?? novel.slug;
    return this.getBySlug(nextSlug);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const novel = await this.novels.findOne({ where: { id } });
    if (!novel) throw new NotFoundException("Novel not found");
    await this.db.transaction(async (trx) => {
      await trx.query(`DELETE FROM public.chapter_bodies WHERE novel_id = $1`, [
        id,
      ]);
      await trx.query(`DELETE FROM public.chapters WHERE novel_id = $1`, [id]);
      await trx.query(
        `DELETE FROM public.novel_categories WHERE novel_id = $1`,
        [id]
      );
      await trx.query(`DELETE FROM public.novel_tags WHERE novel_id = $1`, [
        id,
      ]);
      await trx.getRepository(Novel).delete({ id });
    });
    await this.storage.deleteObject(novel.cover_image_key);
    return { ok: true };
  }

  private async ensureIndexes() {
    await this.runIndex(
      "CREATE INDEX IF NOT EXISTS idx_novels_title_lower ON public.novels (LOWER(title))",
      "idx_novels_title_lower"
    );
    await this.runIndex(
      "CREATE INDEX IF NOT EXISTS idx_novels_slug_lower ON public.novels (LOWER(slug))",
      "idx_novels_slug_lower"
    );
    await this.runIndex(
      "CREATE INDEX IF NOT EXISTS idx_novel_categories_novel ON public.novel_categories (novel_id)",
      "idx_novel_categories_novel"
    );
    await this.runIndex(
      "CREATE INDEX IF NOT EXISTS idx_novel_tags_novel ON public.novel_tags (novel_id)",
      "idx_novel_tags_novel"
    );
    await this.runIndex(
      "CREATE INDEX IF NOT EXISTS idx_chapters_novel ON public.chapters (novel_id)",
      "idx_chapters_novel"
    );
    await this.runIndex(
      "CREATE INDEX IF NOT EXISTS idx_novel_views_date ON public.novel_views (view_date, novel_id)",
      "idx_novel_views_date",
      true
    );
  }

  private async runIndex(sql: string, label: string, optional = false) {
    try {
      await this.db.query(sql);
    } catch (error) {
      let message: string;
      if (error instanceof Error) message = error.message;
      else if (typeof error === "string") message = error;
      else message = JSON.stringify(error ?? "unknown");
      if (optional) {
        this.logger.debug(`Skip optional index ${label}: ${message}`);
      } else {
        this.logger.warn(`Cannot ensure index ${label}: ${message}`);
      }
    }
  }

  private mapToSummary(novel: SummarySource): NovelSummaryResponse {
    return {
      id: novel.id,
      title: novel.title,
      slug: novel.slug,
      description: novel.description ?? null,
      cover_image_key: novel.cover_image_key ?? null,
      status: novel.status ?? null,
      words_count: this.normalizeNumeric(novel.words_count),
      views: this.normalizeNumeric(novel.views),
      author_id: novel.author_id ?? null,
      updated_at:
        novel.updated_at instanceof Date
          ? novel.updated_at.toISOString()
          : new Date(novel.updated_at).toISOString(),
    };
  }

  private mapToDetail(novel: DetailSource): NovelDetailResponse {
    const summary = this.mapToSummary(novel);
    return {
      ...summary,
      category_ids: Array.isArray(novel.category_ids) ? novel.category_ids : [],
      tag_ids: Array.isArray(novel.tag_ids) ? novel.tag_ids : [],
    };
  }

  private normalizeNumeric(value?: string | number | null): string | number {
    if (typeof value === "number") return value;
    if (value === null || value === undefined) return "0";
    return value;
  }

  async upsertFromCrawl(
    input: {
      source_id: string; // 'truyenchuhay' | 'truyenfull'
      ext_series_id: string; // slug/id ngoài
      url?: string | null;
      title: string;
      slug: string; // đã slugifySafe ở crawler
      description?: string | null;
      cover_image_key?: string | null;
      status?: Novel["status"];
      author_id?: string | null;
      original_title?: string | null;
      alt_titles?: string[] | null;
      language_code?: string | null;
      is_featured?: boolean;
      mature?: boolean;
      priority?: number;
    },
    maps: SourceMapsService
  ): Promise<Novel> {
    const sSlug = (input.slug || "").toLowerCase();

    // 1) Ưu tiên tìm bằng series_source_map
    const mapped = await maps.findNovelIdBySeriesMap(
      input.source_id,
      input.ext_series_id
    );
    let novel = mapped
      ? await this.novels.findOne({ where: { id: mapped } })
      : null;

    // 2) Fallback theo slug (đã unique)
    if (!novel) {
      novel = await this.novels.findOne({ where: { slug: sSlug } });
    }

    const payload: Partial<Novel> = {
      title: input.title.trim(),
      slug: sSlug,
      description: input.description ?? "",
      cover_image_key: input.cover_image_key ?? null,
      status: input.status ?? "ongoing",
      source: "crawler",
      source_url: input.url ?? null,
      author_id: input.author_id ?? null,
      original_title: input.original_title ?? null,
      alt_titles: Array.isArray(input.alt_titles) ? input.alt_titles : null,
      language_code: input.language_code ?? null,
      is_featured: !!input.is_featured,
      mature: !!input.mature,
      priority: typeof input.priority === "number" ? input.priority : 0,
    };

    if (!novel) {
      novel = await this.novels.save(this.novels.create(payload));
    } else {
      // không override cover admin đã đặt tay nếu sau này bạn muốn (tuỳ chọn)
      await this.novels.update(
        { id: novel.id },
        { ...payload, updated_at: new Date() }
      );
      novel = await this.novels.findOneOrFail({ where: { id: novel.id } });
    }

    // 3) Ghi series_source_map
    await maps.upsertSeriesMap({
      source_id: input.source_id,
      ext_series_id: input.ext_series_id,
      novel_id: novel.id,
      url: input.url ?? null,
    });

    return novel;
  }
}

function parseDateInput(input?: string | Date | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;
  const timestamp = Date.parse(input);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}
