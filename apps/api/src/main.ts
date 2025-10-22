import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import helmet from "helmet";
import { ValidationPipe } from "@nestjs/common";
import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { CrawlQueue } from "./crawl/crawl.queue";

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

  const crawlQueue = app.get(CrawlQueue);
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/bull");
  createBullBoard({
    queues: [
      new BullMQAdapter(crawlQueue.seriesQueue),
      new BullMQAdapter(crawlQueue.chapterQueue),
    ],
    serverAdapter,
  });
  app.use("/bull", serverAdapter.getRouter());

  await app.listen(Number(process.env.API_PORT || 4000));
  console.log(
    `API listening on http://localhost:${process.env.API_PORT || 4000}`
  );
  console.log("BullMQ dashboard available at /bull");
}
void bootstrap();
