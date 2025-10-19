import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { Tag } from "../../entities/tag.entity";

@Injectable()
export class TagsService {
  constructor(@InjectRepository(Tag) private readonly tags: Repository<Tag>) {}

  list(q?: string) {
    return this.tags.find({
      where: q ? { name: ILike(`%${q}%`) } : {},
      order: { name: "ASC" },
    });
  }

  async create(data: { name: string }) {
    if (!data?.name?.trim())
      throw new BadRequestException("Tag name is required");
    return this.tags.save({ name: data.name.trim() });
  }
}
