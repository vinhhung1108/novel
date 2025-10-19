import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { Novel } from "../entities/novel.entity";

/** slugify an toàn (chuyển đ/Đ → d, bỏ dấu, giữ a-z0-9- ) */
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

@Injectable()
export class NovelsService {
  constructor(
    @InjectRepository(Novel)
    private readonly novels: Repository<Novel>
  ) {}

  async list(
    page = 1,
    limit = 12,
    opts?: { q?: string; sort?: "updated_at" | "title"; order?: "ASC" | "DESC" }
  ) {
    const { q, sort = "updated_at", order = "DESC" } = opts || {};
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
    const s = slugifySafe(slug || "");
    if (!s || s !== slug) {
      // không hợp lệ theo định dạng (chỉ a-z0-9-)
      return { exists: false, valid: false };
    }
    const found = await this.novels.findOne({ where: { slug: s } });
    return { exists: !!found, valid: true };
  }

  async create(data: Partial<Novel>) {
    if (!data?.title?.trim()) {
      throw new BadRequestException("Title is required");
    }
    const base = data.slug?.trim() || data.title;
    let baseSlug = slugifySafe(base!);
    if (!baseSlug) throw new BadRequestException("Cannot generate slug");

    // ensure unique
    let unique = baseSlug;
    for (let suffix = 2; ; suffix++) {
      const existed = await this.novels.findOne({ where: { slug: unique } });
      if (!existed) break;
      unique = `${baseSlug}-${suffix}`;
      if (suffix > 200) throw new BadRequestException("Slug overflow");
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

      // các field mở rộng nếu bạn đã thêm (optional)
      original_title: (data as any).original_title ?? null,
      alt_titles: Array.isArray((data as any).alt_titles)
        ? (data as any).alt_titles
        : null,
      language_code: (data as any).language_code ?? null,
      is_featured: (data as any).is_featured ?? false,
      mature: (data as any).mature ?? false,
      priority:
        typeof (data as any).priority === "number" ? (data as any).priority : 0,
    });

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

    // các field mở rộng (nếu schema có)
    if ("original_title" in (data as any))
      patch.original_title = (data as any).original_title ?? null;
    if ("alt_titles" in (data as any)) {
      const arr = (data as any).alt_titles;
      patch.alt_titles = Array.isArray(arr) ? arr : null;
    }
    if ("language_code" in (data as any))
      patch.language_code = (data as any).language_code ?? null;
    if ("is_featured" in (data as any))
      patch.is_featured = !!(data as any).is_featured;
    if ("mature" in (data as any)) patch.mature = !!(data as any).mature;
    if ("priority" in (data as any)) {
      const pr = (data as any).priority;
      patch.priority = typeof pr === "number" ? pr : 0;
    }

    await this.novels.update({ id }, patch);
    return this.novels.findOne({ where: { id } });
  }

  async remove(id: string) {
    const novel = await this.novels.findOne({ where: { id } });
    if (!novel) throw new NotFoundException("Novel not found");
    await this.novels.delete({ id });
    return { ok: true };
  }
}
