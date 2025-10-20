import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { Tag } from "@/entities/tag.entity";

/** slugify an toàn (đổi đ/Đ → d, bỏ dấu, chỉ còn a-z0-9-) */
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
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tags: Repository<Tag>
  ) {}

  async list(page = 1, limit = 50, q?: string, order: "ASC" | "DESC" = "ASC") {
    const where = q
      ? [{ name: ILike(`%${q}%`) }, { slug: ILike(`%${q}%`) }]
      : undefined;

    const [items, total] = await this.tags.findAndCount({
      where,
      order: { name: order, id: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async slugExists(slugInput: string) {
    const s = slugifySafe(slugInput || "");
    if (!s || s !== slugInput) {
      return { exists: false, valid: false };
    }
    const found = await this.tags.findOne({ where: { slug: s } });
    return { exists: !!found, valid: true };
  }

  async create(data: Partial<Tag>) {
    if (!data?.name?.trim()) {
      throw new BadRequestException("name is required");
    }
    const base = data.slug?.trim() || data.name;
    let baseSlug = slugifySafe(base!);
    if (!baseSlug) throw new BadRequestException("Cannot generate slug");

    // unique slug
    let unique = baseSlug;
    for (let i = 2; ; i++) {
      const existed = await this.tags.findOne({ where: { slug: unique } });
      if (!existed) break;
      unique = `${baseSlug}-${i}`;
      if (i > 200) throw new BadRequestException("Slug overflow");
    }

    const tag = await this.tags.save({
      name: data.name!.trim(),
      slug: unique,
      description: data.description ?? null,
    });

    return tag;
  }

  async update(id: string, data: Partial<Tag>) {
    const tag = await this.tags.findOne({ where: { id } });
    if (!tag) throw new NotFoundException("Tag not found");

    const patch: Partial<Tag> = {};

    if (typeof data.name === "string") patch.name = data.name.trim();
    if (typeof data.description === "string")
      patch.description = data.description;

    if (typeof data.slug === "string") {
      const next = slugifySafe(data.slug);
      if (!next) throw new BadRequestException("Slug is invalid");
      if (next !== tag.slug) {
        const existed = await this.tags.findOne({ where: { slug: next } });
        if (existed && existed.id !== id) {
          throw new BadRequestException("Slug already exists");
        }
        patch.slug = next;
      }
    }

    await this.tags.update({ id }, patch);
    return this.tags.findOne({ where: { id } });
  }

  async remove(id: string) {
    const tag = await this.tags.findOne({ where: { id } });
    if (!tag) throw new NotFoundException("Tag not found");
    await this.tags.delete({ id });
    return { ok: true };
  }
}
