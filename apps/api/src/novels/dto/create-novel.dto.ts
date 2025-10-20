import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { Column } from "typeorm";

export class CreateNovelDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  cover_image_key?: string | null;

  // mở rộng
  @IsOptional()
  @IsString()
  original_title?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alt_titles?: string[] | null;

  @IsOptional()
  @IsString()
  language_code?: string | null;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @IsOptional()
  @IsBoolean()
  mature?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @Column("uuid", { name: "author_id", nullable: true })
  author_id: string | null;
}
