import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import * as cheerio from "cheerio";
import { CrawlerPersistService } from "@/modules/crawl/crawler-persist.service";
import { CrawlHttpService } from "@/modules/crawl/http.service";
import { CHAPTER_QUEUE } from "@/modules/crawl/constants";
import { resolveAdapter } from "@/modules/crawl/adapters";
import { CrawlStateService } from "@/modules/crawl/crawl-state.service";

const toAbs = (base: string, href?: string | null) => {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
};

type ChapterJobData = {
  source_id: string;
  novel_id: string;
  url: string;
  followNext?: boolean;
  source_meta?: {
    name?: string;
    base_url?: string;
  };
  run_id?: string;
  ext_series_id?: string;
};

function indexFromUrl(url: string) {
  try {
    const { pathname } = new URL(url);
    const m = pathname.match(/\/chuong-(\d+)\/?$/i);
    return m ? parseInt(m[1], 10) : NaN;
  } catch {
    return NaN;
  }
}

@Processor(CHAPTER_QUEUE)
export class ChapterProcessor extends WorkerHost {
  constructor(
    private readonly persist: CrawlerPersistService,
    private readonly http: CrawlHttpService,
    private readonly state: CrawlStateService,
    @InjectQueue(CHAPTER_QUEUE) private readonly crawlQ: Queue
  ) {
    super();
  }

  async process(job: Job<any>) {
    if (job.name !== "parse-chapter-page") return;

    const {
      source_id: rawSourceId,
      novel_id,
      url,
      followNext = true,
      source_meta,
      run_id,
      ext_series_id,
    } = job.data as ChapterJobData;

    const adapter = resolveAdapter({
      sourceId: rawSourceId,
      sourceName: source_meta?.name,
      baseUrl: source_meta?.base_url,
      identifier: source_meta?.name ?? rawSourceId,
    });

    try {
      const html = await this.http.fetchHtml(url, 20000);
      const $ = cheerio.load(html);
      const parsed = adapter.parseChapter ? adapter.parseChapter(html, url) : null;

      let index_no = parsed?.index ?? indexFromUrl(url);
      if (!Number.isFinite(index_no)) {
        const candidate =
          $(".chapter-title, h1, h2.title").first().text().trim() ||
          $('meta[property="og:title"]').attr("content")?.trim() ||
          "";
        const m = candidate.match(/(\d+)\b/);
        index_no = m ? parseInt(m[1], 10) : NaN;
      }
      if (!Number.isFinite(index_no)) throw new Error("cannot detect index_no");

      const title =
        parsed?.title ||
        $(".chapter-title, h1, h2.title").first().text().trim() ||
        $("[itemprop='headline']").first().text().trim() ||
        `Chương ${index_no}`;

      const fallbackContent =
        $("#chapter-c, .chapter-c, .chapter-content, .content, .entry-content")
          .first()
          .html()
          ?.trim() ||
        "";

      const content_html = parsed?.contentHtml ?? fallbackContent;

      let ext_chapter_id = url;
      try {
        ext_chapter_id = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
      } catch {
        /* keep raw url */
      }

      const { source_id, chapter } = await this.persist.upsertChapter({
        source_id: rawSourceId,
        ext_chapter_id,
        novel_id,
        index_no,
        title,
        url,
        content_html,
      });

      if (ext_series_id) {
        await this.state.updateSeriesLastIndex(source_id, ext_series_id, index_no);
      }

      if (run_id) {
        await this.state.incrementCompletedChapters(run_id, 1);
      }

      let nextUrl = parsed?.nextUrl
        ? toAbs(url, parsed.nextUrl) || parsed.nextUrl
        : null;
      if (!nextUrl) {
        const fallbackNext =
          $("a[rel='next']").attr("href") ||
          $("a:contains('Chương sau'), a:contains('Chương tiếp')").attr("href") ||
          $(".chapter-nav a[rel='next']").attr("href") ||
          $("a.next-chap[href]").attr("href");
        nextUrl = toAbs(url, fallbackNext);
      }

      if (!followNext) {
        nextUrl = null;
      }

      if (nextUrl) {
        if (run_id) {
          await this.state.incrementQueuedChapters(run_id, 1);
        }
        await this.crawlQ.add(
          "parse-chapter-page",
          {
            source_id,
            novel_id,
            url: nextUrl,
            followNext: true,
            source_meta,
            run_id,
            ext_series_id,
          },
          { attempts: 3, backoff: { type: "exponential", delay: 2000 } }
        );
      }

      return {
        ok: true,
        novel_id,
        index_no: chapter.index_no,
        next_enqueued: !!nextUrl,
      };
    } catch (err) {
      if (run_id) {
        await this.state.incrementFailedJobs(run_id, 1);
      }
      throw err;
    }
  }
}
