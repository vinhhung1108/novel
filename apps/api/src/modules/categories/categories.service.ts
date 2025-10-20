import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { Category } from "@/entities/category.entity";

/** slugify đơn giản + chuyển đ/Đ → d */
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
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>
  ) {}

  async list(page = 1, limit = 50, q?: string) {
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(200, Math.max(1, Number(limit) || 50));
    const where = q
      ? [{ name: ILike(`%${q}%`) }, { slug: ILike(`%${q}%`) }]
      : undefined;
    const [items, total] = await this.categories.findAndCount({
      where,
      order: { name: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async create(data: Partial<Category>) {
    const name = data?.name?.trim();
    if (!name) throw new BadRequestException("name is required");
    const baseInput = data.slug?.trim() ?? name;
    const baseSlug = slugifySafe(baseInput);
    if (!baseSlug) throw new BadRequestException("Cannot generate slug");

    // unique slug
    let unique = baseSlug;
    for (let i = 2; ; i++) {
      const existed = await this.categories.findOne({
        where: { slug: unique },
      });
      if (!existed) break;
      unique = `${baseSlug}-${i}`;
      if (i > 200) throw new BadRequestException("Slug overflow");
    }

    const cat = await this.categories.save({
      name,
      slug: unique,
      description: data.description ?? null,
    });
    return cat;
  }

  async update(id: string, data: Partial<Category>) {
    const cat = await this.categories.findOne({ where: { id } });
    if (!cat) throw new NotFoundException("Category not found");

    const patch: Partial<Category> = {};

    if (typeof data.name === "string") patch.name = data.name.trim();
    if (typeof data.description === "string")
      patch.description = data.description;

    if (typeof data.slug === "string") {
      const next = slugifySafe(data.slug);
      if (!next) throw new BadRequestException("Slug is invalid");
      if (next !== cat.slug) {
        const existed = await this.categories.findOne({
          where: { slug: next },
        });
        if (existed && existed.id !== id) {
          throw new BadRequestException("Slug already exists");
        }
        patch.slug = next;
      }
    }

    await this.categories.update({ id }, patch);
    return this.categories.findOne({ where: { id } });
  }

  async remove(id: string) {
    const cat = await this.categories.findOne({ where: { id } });
    if (!cat) throw new NotFoundException("Category not found");
    await this.categories.delete({ id });
    return { ok: true };
  }

  getById(id: string) {
    return this.categories.findOne({ where: { id } });
  }

  async slugExists(slug: string) {
    const s = slugifySafe(slug || "");
    if (!s || s !== slug) return { exists: false, valid: false };
    const found = await this.categories.findOne({ where: { slug: s } });
    return { exists: !!found, valid: true };
  }
}
