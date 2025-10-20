import { Injectable, Logger } from "@nestjs/common";
import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface PresignOptions {
  key?: string;
  ext?: string;
  contentType?: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket = process.env.S3_BUCKET || "novels";
  private readonly s3 = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "minio",
      secretAccessKey: process.env.S3_SECRET_KEY || "minio123",
    },
    forcePathStyle: true,
  });

  async presignUpload(body: PresignOptions) {
    const key = body.key || `uploads/${Date.now()}.${body.ext || "jpg"}`;
    const contentType = body.contentType || "image/jpeg";
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.s3, cmd, { expiresIn: 60 * 5 });
    return { url, key } as const;
  }

  async deleteObject(key: string | null | undefined) {
    if (!key) return;
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
    } catch (error) {
      let message: string;
      if (error instanceof Error) message = error.message;
      else if (typeof error === "string") message = error;
      else if (error && typeof error === "object")
        message = JSON.stringify(error);
      else message = "unknown error";
      this.logger.warn(
        `Failed to delete object "${key}" from bucket "${this.bucket}": ${message}`
      );
    }
  }
}
