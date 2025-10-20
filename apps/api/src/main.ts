import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import helmet from "helmet";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
  );
  app.enableCors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: false,
  });
  app.use(helmet());
  await app.listen(Number(process.env.API_PORT || 4000));
  console.log(
    `API listening on http://localhost:${process.env.API_PORT || 4000}`
  );
}
bootstrap();
