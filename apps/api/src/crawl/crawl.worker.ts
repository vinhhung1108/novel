import { Worker, QueueEvents } from "bullmq";
import { load as loadHtml } from "cheerio";
import { request } from "undici";
import {
  Injectable,
  OnModuleInit,
  Logger,
  OnModuleDestroy,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { normalizeHtmlToText } from "./normalize";
import { upsertSeries, upsertChapter } from "./writers";

@Injectable()
export class CrawlWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrawlWorker.name);
  private seriesWorker?: Worker;
  private chapterWorker?: Worker;
  private seriesEvents?: QueueEvents;
  private chapterEvents?: QueueEvents;

  constructor(private readonly ds: DataSource) {}

  onModuleInit() {
    const connection = {
      host: process.env.REDIS_HOST ?? "localhost",
      port: +(process.env.REDIS_PORT ?? 6379),
    };

    this.seriesWorker = new Worker(
      "crawl:series",
      async (job) => {
        const { sourceId, extSeriesId, url } = job.data as {
          sourceId: string;
          extSeriesId: string;
          url: string;
        };

        const res = await request(url, {
          method: "GET",
          headers: { "User-Agent": "NovelBot/1.0 (+contact@example.com)" },
        });
        if (res.statusCode >= 400)
          throw new Error(`Series fetch ${url} failed ${res.statusCode}`);
        const html = await res.body.text();
        const $ = loadHtml(html);

        // Parser tuỳ nguồn: ví dụ
        const title = $("h1").first().text().trim();
        const authorName =
          $('a[rel="author"]').first().text().trim() ||
          $(".author").first().text().trim();
        const coverUrl =
          $("img.cover").attr("src") ??
          $("meta[property='og:image']").attr("content");

        const { seriesId } = await upsertSeries(this.ds, {
          title,
          authorName,
          coverUrl,
          sourceId,
          extSeriesId,
          url,
        });

        // Lấy danh sách chương
        const chapters: Array<{
          extChapterId: string;
          url: string;
          indexNo: number;
          title?: string;
        }> = [];
        $(".chapter-list a").each((i, el) => {
          const href = $(el).attr("href");
          const text = $(el).text().trim();
          if (!href) return;
          const extChapterId = new URL(href, url).pathname; // hoặc regex theo nguồn
          chapters.push({
            extChapterId,
            url: new URL(href, url).toString(),
            indexNo: i + 1,
            title: text,
          });
        });

        return { seriesId, chaptersCount: chapters.length, chapters };
      },
      { connection }
    );

    this.chapterWorker = new Worker(
      "crawl:chapter",
      async (job) => {
        const { sourceId, extChapterId, url, seriesId, indexNo } = job.data as {
          sourceId: string;
          extChapterId: string;
          url: string;
          seriesId: string;
          indexNo?: number;
        };

        const res = await request(url, {
          method: "GET",
          headers: { "User-Agent": "NovelBot/1.0 (+contact@example.com)" },
        });
        if (res.statusCode >= 400)
          throw new Error(`Chapter fetch ${url} failed ${res.statusCode}`);
        const html = await res.body.text();
        const $ = loadHtml(html);

        const chapterTitle =
          $("h1").first().text().trim() ||
          $(".chapter-title").first().text().trim();
        const contentHtml =
          $(".chapter-content").html() ??
          $("#chapter-content").html() ??
          $("article").html() ??
          "";
        const contentText = normalizeHtmlToText(contentHtml);

        await upsertChapter(this.ds, {
          sourceId,
          extChapterId,
          seriesId,
          indexNo,
          title: chapterTitle,
          content: contentText,
          extUrl: url,
        });
      },
      { connection }
    );

    // Optional: events log
    this.seriesEvents = new QueueEvents("crawl:series", { connection });
    this.seriesEvents.on(
      "failed",
      ({ jobId, failedReason }) =>
        this.logger.warn(`series failed ${jobId} ${failedReason}`)
    );
    this.chapterEvents = new QueueEvents("crawl:chapter", { connection });
    this.chapterEvents.on(
      "failed",
      ({ jobId, failedReason }) =>
        this.logger.warn(`chapter failed ${jobId} ${failedReason}`)
    );
  }

  async onModuleDestroy() {
    const tasks: Array<Promise<unknown>> = [];
    if (this.seriesWorker) tasks.push(this.seriesWorker.close());
    if (this.chapterWorker) tasks.push(this.chapterWorker.close());
    if (this.seriesEvents) tasks.push(this.seriesEvents.close());
    if (this.chapterEvents) tasks.push(this.chapterEvents.close());
    if (tasks.length > 0) await Promise.allSettled(tasks);
  }
}
