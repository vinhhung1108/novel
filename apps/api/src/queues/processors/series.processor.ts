import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import * as cheerio from "cheerio";
import {
  CrawlerPersistService,
  NovelDTO,
} from "@/modules/crawl/crawler-persist.service";
import { CrawlHttpService } from "@/modules/crawl/http.service";
import { CHAPTER_QUEUE, SERIES_QUEUE } from "@/modules/crawl/constants";
import { MAX_CHAPTER_PREFETCH } from "@/modules/crawl/config";
import { resolveAdapter } from "@/modules/crawl/adapters";
import { CrawlStateService } from "@/modules/crawl/crawl-state.service";

type SeriesJobData = {
  source_id: string;
  url: string;
  source_meta?: {
    name?: string;
    base_url?: string;
  };
  run_id?: string;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const toAbs = (base: string, href?: string | null) => {
  if (!href) return null;
  try { return new URL(href, base).toString(); } catch { return null; }
};

const chapterIndexFromUrl = (input: string): number | null => {
  try {
    const { pathname } = new URL(input);
    const match = pathname.match(/\/(?:chuong|chapter)-(\d+)\/?$/i);
    if (match) return parseInt(match[1], 10);
  } catch {
    /* ignore */
  }
  return null;
};

@Processor(SERIES_QUEUE)
export class SeriesProcessor extends WorkerHost {
  constructor(
    private readonly persist: CrawlerPersistService,
    private readonly http: CrawlHttpService,
    private readonly state: CrawlStateService,
    @InjectQueue(CHAPTER_QUEUE) private readonly chapterQ: Queue
  ) {
    super();
  }

  async process(job: Job<any>) {
    if (job.name !== "parse-series-page") return;

    const { source_id: rawSourceId, url, source_meta, run_id } =
      job.data as SeriesJobData;

    const adapter = resolveAdapter({
      sourceId: rawSourceId,
      sourceName: source_meta?.name,
      baseUrl: source_meta?.base_url,
      identifier: source_meta?.name ?? rawSourceId,
    });

    try {
      const html = await this.http.fetchHtml(url, 20000);
      const $ = cheerio.load(html);
      const parsed = adapter.parseSeries(html, url) ?? {};

      const fallbackTitle =
        $("h1").first().text().trim() ||
        $(".book-title, .title, .truyen-title").first().text().trim() ||
        $('meta[property="og:title"]').attr("content")?.trim() ||
        $('meta[name="title"]').attr("content")?.trim() ||
        $("title").text().split("|")[0]?.trim() ||
        "";

      const title = (parsed.title || fallbackTitle).trim();
      if (!title) throw new Error("cannot parse series title");

      const deriveExtSeriesId = () => {
        if (parsed.extSeriesId) return parsed.extSeriesId;
        try {
          return new URL(url).pathname.replace(/^\/+|\/+$/g, "");
        } catch {
          return slugify(title);
        }
      };

      const ext_series_id = deriveExtSeriesId();
      const slugSource = parsed.title || title || ext_series_id || url;
      let slug = slugify(slugSource);
      if (!slug) slug = slugify(ext_series_id || `novel-${Date.now()}`);

      const fallbackDescription =
        $(".desc, .book-desc, .mota, .description, #gioi-thieu")
          .first()
          .text()
          .trim() ||
        $('[itemprop="description"]').first().text().trim() ||
        $('meta[name="description"]').attr("content")?.trim() ||
        null;

      const description = parsed.description ?? fallbackDescription;

      const bodyText = $("body").text() || "";
      const status =
        parsed.status ??
        (/\bhoàn\b|\bfull\b|\bcompleted\b/i.test(bodyText)
          ? "completed"
          : "ongoing");

      const dto: Omit<NovelDTO, "source_id"> = {
        ext_series_id,
        url: parsed.canonicalUrl || url,
        title,
        slug,
        description,
        cover_image_key: null,
        status,
        alt_titles: parsed.altTitles ?? undefined,
      };

      const { novel, source_id } = await this.persist.upsertNovel({
        ...dto,
        source_id: rawSourceId,
      });

      const urlSet = new Set<string>();
      const pushUrl = (u?: string | null) => {
        if (!u) return;
        const absUrl = toAbs(url, u) || u;
        if (absUrl) urlSet.add(absUrl);
      };

      pushUrl(parsed.firstChapterUrl);

      if (parsed.chapterUrls && parsed.chapterUrls.length) {
        parsed.chapterUrls.slice(0, MAX_CHAPTER_PREFETCH).forEach((u) =>
          pushUrl(u)
        );
      }

      if (!urlSet.size) {
        const fallbackHref =
          $("a:contains('Chương 1'), a:contains('ĐỌC TỪ ĐẦU'), a:contains('Đọc từ đầu')")
            .first()
            .attr("href") ||
          $(".list-chapter a[href], .chapter-list a[href], .list-chapters a[href]")
            .first()
            .attr("href") ||
          $("a[href*='chuong-1']").first().attr("href");

        pushUrl(fallbackHref);

        if (!urlSet.size) {
          try {
            const fallback = new URL(url);
            if (/^\/[^/]+\/?$/.test(fallback.pathname)) {
              if (!fallback.pathname.endsWith("/")) fallback.pathname += "/";
              fallback.pathname = `${fallback.pathname}chuong-1/`;
              pushUrl(fallback.toString());
            }
          } catch {
            /* noop */ 
          }
        }
      }

      const lastKnownIndex = await this.state.getSeriesLastIndex(
        source_id,
        ext_series_id
      );
      const filteredUrls = Array.from(urlSet).filter((chapterUrl) => {
        if (lastKnownIndex === null) return true;
        const idx = chapterIndexFromUrl(chapterUrl);
        const isFiniteIndex = typeof idx === "number" && Number.isFinite(idx);
        return !(isFiniteIndex && (idx as number) <= lastKnownIndex);
      });

      const finalUrlSet = new Set(filteredUrls);

      const chapterListCount = parsed.chapterUrls?.length ?? 0;
      const hasChapterList = chapterListCount > 0;
      const reachedLimit = chapterListCount >= MAX_CHAPTER_PREFETCH;
      const followNext = Boolean(parsed.hasMoreChapters) || !hasChapterList || reachedLimit;

      if (finalUrlSet.size) {
        if (run_id) {
          await this.state.incrementQueuedChapters(run_id, finalUrlSet.size);
        }

        const jobsPayload = Array.from(finalUrlSet).map((chapterUrl) => ({
          name: "parse-chapter-page" as const,
          data: {
            source_id,
            novel_id: novel.id,
            url: chapterUrl,
            followNext,
            source_meta,
            run_id,
            ext_series_id,
          },
          opts: { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
        }));

        await this.chapterQ.addBulk(jobsPayload);
      }

      if (run_id) {
        await this.state.incrementCompletedSeries(run_id, 1);
      }

      return {
        ok: true,
        novel_id: novel.id,
        chapters_enqueued: finalUrlSet.size,
        follow_next: followNext,
      };
    } catch (error) {
      if (run_id) {
        await this.state.incrementFailedJobs(run_id, 1);
      }
      throw error;
    }
  }
}
