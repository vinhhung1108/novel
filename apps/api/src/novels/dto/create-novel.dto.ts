import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { NovelSource, NovelStatus } from "@/entities/novel.entity";

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

  // liên kết tác giả (tuỳ chọn)
  @IsOptional()
  @IsUUID()
  author_id?: string;

  @IsOptional()
  @IsIn(["ongoing", "completed", "hiatus"])
  status?: NovelStatus;

  @IsOptional()
  @IsIn(["local", "crawler"])
  source?: NovelSource;

  @IsOptional()
  @IsString()
  source_url?: string | null;

  @IsOptional()
  @IsString()
  published_at?: string | null;
}
