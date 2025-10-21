import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DataSource } from "typeorm";
import { CrawlQueue } from "./crawl.queue";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const ds = app.get(DataSource);
  const q = app.get(CrawlQueue);

  const cmd = process.argv[2];

  if (cmd === "init-source") {
    const [name, baseUrl] = process.argv.slice(3);
    const r = await ds.query(
      `INSERT INTO source(name, base_url) VALUES($1,$2) ON CONFLICT (base_url) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      [name, baseUrl]
    );
    console.log("source id:", r[0].id);
  }

  if (cmd === "crawl-series") {
    const [sourceId, extSeriesId, url] = process.argv.slice(3);
    await q.seriesQueue.add(
      "series",
      { sourceId, extSeriesId, url },
      { jobId: `series_${sourceId}_${extSeriesId}`, removeOnComplete: true }
    );
    console.log("enqueued series", extSeriesId);
  }

  if (cmd === "crawl-chapter") {
    const [sourceId, seriesId, extChapterId, url, indexNoStr] =
      process.argv.slice(3);
    const indexNo = indexNoStr ? parseInt(indexNoStr, 10) : undefined;
    await q.chapterQueue.add(
      "chapter",
      { sourceId, seriesId, extChapterId, url, indexNo },
      { jobId: `chapter_${sourceId}_${extChapterId}`, removeOnComplete: true }
    );
    console.log("enqueued chapter", extChapterId);
  }

  await app.close();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
