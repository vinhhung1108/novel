import { IsOptional, IsString, IsUUID, IsUrl } from "class-validator";

export class EnqueueSeriesDto {
  @IsUUID() sourceId!: string;

  @IsString()
  extSeriesId!: string; // bạn có thể dùng slug/đường dẫn ngoài

  @IsUrl()
  url!: string;

  @IsOptional()
  @IsString()
  authorName?: string;
}
