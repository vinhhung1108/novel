import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, ILike, Repository } from "typeorm";
import { Novel } from "../entities/novel.entity";
import { StorageService } from "@/upload/storage.service";
import { CreateNovelDto } from "./dto/create-novel.dto";
import { QueryFailedError } from "typeorm";

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

export interface NovelListItem {
  id: string;
  title: string;
  slug: string;
  description: string;
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

@Injectable()
export class NovelsService {
  constructor(
    @InjectRepository(Novel)
    private readonly novels: Repository<Novel>,
    private readonly db: DataSource,
    private readonly storage: StorageService
  ) {}

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
  ): Promise<{ items: NovelListItem[]; total: number; page: number; limit: number }> {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit)
      ? Math.min(Math.max(limit, 1), 48)
      : 12;
    const q = opts?.q?.trim();
    const sort = opts?.sort === "title" ? "title" : "updated_at";
    const order: "ASC" | "DESC" = opts?.order === "ASC" ? "ASC" : "DESC";

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
        author_id: true,
      },
      where,
      order: { [sort]: order, id: "ASC" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });
    return {
      items: items as NovelListItem[],
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async getBySlug(slug: string): Promise<NovelWithRelations | null> {
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

    return {
      ...novel,
      category_ids: categoryRows.map((row) => row.category_id),
      tag_ids: tagRows.map((row) => row.tag_id),
    };
  }

  async slugExists(slug: string) {
    const s = slugifySafe(slug || "");
    if (!s || s !== slug) {
      return { exists: false, valid: false };
    }
    const found = await this.novels.findOne({ where: { slug: s } });
    return { exists: !!found, valid: true };
  }

  async create(data: CreateNovelDto): Promise<Novel> {
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
      return await this.novels.save(entity);
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

  async update(id: string, data: UpdateNovelInput): Promise<Novel | null> {
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
    return this.novels.findOne({ where: { id } });
  }

  async remove(id: string): Promise<{ ok: true }> {
    const novel = await this.novels.findOne({ where: { id } });
    if (!novel) throw new NotFoundException("Novel not found");
    await this.db.transaction(async (trx) => {
      await trx.query(
        `DELETE FROM public.chapter_bodies WHERE novel_id = $1`,
        [id]
      );
      await trx.query(`DELETE FROM public.chapters WHERE novel_id = $1`, [id]);
      await trx.query(
        `DELETE FROM public.novel_categories WHERE novel_id = $1`,
        [id]
      );
      await trx.query(
        `DELETE FROM public.novel_tags WHERE novel_id = $1`,
        [id]
      );
      await trx.getRepository(Novel).delete({ id });
    });
    await this.storage.deleteObject(novel.cover_image_key);
    return { ok: true };
  }
}

function parseDateInput(input?: string | Date | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;
  const timestamp = Date.parse(input);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}
