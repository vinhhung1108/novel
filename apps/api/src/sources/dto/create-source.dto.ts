import { IsNotEmpty, IsString, IsUrl } from "class-validator";

export class CreateSourceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUrl()
  base_url!: string;
}
