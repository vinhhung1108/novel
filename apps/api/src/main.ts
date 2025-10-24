import "reflect-metadata";
import "./env";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import helmet from "helmet";
import { ValidationPipe } from "@nestjs/common";

function parseOrigins(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
  );

  // CORS: cho phép credentials + origin cụ thể (không dùng "*")
  const corsOrigins = parseOrigins(process.env.API_CORS_ORIGINS) || [];

  if (corsOrigins.length === 0) {
    corsOrigins.push("http://localhost:3000", "http://localhost:3001");
  }

  app.enableCors({
    origin: corsOrigins, // array các origin hợp lệ
    credentials: true, // QUAN TRỌNG: bật credentials
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    exposedHeaders: ["Content-Range", "X-Total-Count"],
    optionsSuccessStatus: 204,
  });

  // Bảo mật cơ bản
  app.use(helmet());

  const port = Number(process.env.API_PORT || 4000);
  await app.listen(port);

  console.log(`API listening on http://localhost:${port}`);
  console.log("BullMQ dashboard available at /bull");
}

void bootstrap();
