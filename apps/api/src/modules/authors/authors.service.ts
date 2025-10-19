import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { Author } from "@/entities/author.entity";

/** slugify an toàn: chuyển đ/Đ→d, bỏ dấu, chỉ giữ a-z0-9- */
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
export class AuthorsService {
  constructor(
    @InjectRepository(Author)
    private readonly authors: Repository<Author>
  ) {}

  async list(page = 1, limit = 50, q?: string) {
    const where = q
      ? [{ name: ILike(`%${q}%`) }, { slug: ILike(`%${q}%`) }]
      : undefined;

    const [items, total] = await this.authors.findAndCount({
      where: where as any,
      order: { name: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async slugExists(slug: string) {
    const s = slugifySafe(slug || "");
    if (!s || s !== slug) return { exists: false, valid: false };
    const found = await this.authors.findOne({ where: { slug: s } });
    return { exists: !!found, valid: true };
  }

  async create(data: Partial<Author>) {
    const name = data?.name?.trim();
    if (!name) throw new BadRequestException("name is required");

    // Sinh slug từ body.slug (nếu có) hoặc từ name
    const base = data.slug?.trim() || name;
    let baseSlug = slugifySafe(base);
    if (!baseSlug) throw new BadRequestException("Cannot generate slug");

    // Đảm bảo slug duy nhất
    let unique = baseSlug;
    for (let i = 2; ; i++) {
      const existed = await this.authors.findOne({ where: { slug: unique } });
      if (!existed) break;
      unique = `${baseSlug}-${i}`;
      if (i > 200) throw new BadRequestException("Slug overflow");
    }

    // (tuỳ chọn) tránh tạo trùng tên thô
    const dupName = await this.authors.findOne({ where: { name } });
    if (dupName) {
      // không chặn bắt buộc, nhưng nếu muốn chặn thì bật dòng sau:
      // throw new BadRequestException("Author already exists");
    }

    return this.authors.save({
      name,
      slug: unique,
      // nếu entity Author có thêm các field khác, map ở đây
    });
  }

  async update(id: string, data: Partial<Author>) {
    const a = await this.authors.findOne({ where: { id } });
    if (!a) throw new NotFoundException("Author not found");

    const patch: Partial<Author> = {};

    if (typeof data.name === "string") {
      const name = data.name.trim();
      if (!name) throw new BadRequestException("name cannot be empty");
      patch.name = name;
    }

    if (typeof data.slug === "string") {
      const next = slugifySafe(data.slug);
      if (!next) throw new BadRequestException("slug is invalid");
      if (next !== a.slug) {
        const existed = await this.authors.findOne({ where: { slug: next } });
        if (existed && existed.id !== id) {
          throw new BadRequestException("slug already exists");
        }
        patch.slug = next;
      }
    }

    if (Object.keys(patch).length === 0) return a;

    await this.authors.update({ id }, patch);
    return this.authors.findOne({ where: { id } });
  }

  async remove(id: string) {
    const a = await this.authors.findOne({ where: { id } });
    if (!a) throw new NotFoundException("Author not found");
    await this.authors.delete({ id });
    return { ok: true };
  }
}
