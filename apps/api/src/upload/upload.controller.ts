import { Controller, Post, Body } from "@nestjs/common";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Controller("upload")
export class UploadController {
  private s3 = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "minio",
      secretAccessKey: process.env.S3_SECRET_KEY || "minio123",
    },
    forcePathStyle: true,
  });

  @Post("presign")
  async presign(
    @Body() body: { key?: string; ext?: string; contentType?: string }
  ) {
    const bucket = process.env.S3_BUCKET || "novels";
    const key = body.key || `uploads/${Date.now()}.${body.ext || "jpg"}`;
    const contentType = body.contentType || "image/jpeg";
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.s3, cmd, { expiresIn: 60 * 5 });
    return { url, key } as const;
  }
}
