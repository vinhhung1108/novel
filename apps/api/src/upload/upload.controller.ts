import { Controller, Post, Body } from "@nestjs/common";
import { StorageService } from "./storage.service";

@Controller("upload")
export class UploadController {
  constructor(private readonly storage: StorageService) {}

  @Post("presign")
  async presign(
    @Body() body: { key?: string; ext?: string; contentType?: string }
  ) {
    return this.storage.presignUpload(body);
  }
}
