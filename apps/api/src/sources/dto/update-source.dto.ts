import { IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateSourceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  base_url?: string;
}
