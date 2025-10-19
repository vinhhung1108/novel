import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { Author } from "../../entities/author.entity";

@Injectable()
export class AuthorsService {
  constructor(
    @InjectRepository(Author) private readonly authors: Repository<Author>
  ) {}

  list(q?: string) {
    return this.authors.find({
      where: q ? { name: ILike(`%${q}%`) } : {},
      order: { name: "ASC" },
    });
  }

  async create(data: { name: string }) {
    if (!data?.name?.trim())
      throw new BadRequestException("Author name is required");
    return this.authors.save({ name: data.name.trim() });
  }
}
