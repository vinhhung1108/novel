import { Worker, QueueEvents } from "bullmq";
import { load as loadHtml, CheerioAPI } from "cheerio";
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
import { CrawlQueue } from "./crawl.queue";

const toInt = (v: string | undefined, d: number) =>
  Number.isFinite(+(v ?? "")) ? +v! : d;
const CRAWL_CONCURRENCY = toInt(process.env.CRAWL_CONCURRENCY, 2);
const JITTER_MAX_MS = toInt(process.env.CRAWL_JITTER_MAX_MS, 400);
function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function jitter() {
  return Math.floor(Math.random() * (JITTER_MAX_MS + 1));
}

const CHAPTER_LINK_SELECTORS = [
  ".chapter-list a",
  ".list-chapter a",
  ".list-chapters a",
  ".list-chap a",
  ".chapters-list a",
  ".chapter__list a",
  ".table-chapter a",
  ".table-list a",
  ".dsc-chapter a",
  ".chapter-item a",
];

type ChapterLink = {
  href: string;
  text: string;
};

function collectChapterLinks($: CheerioAPI): ChapterLink[] {
  const found = new Map<string, ChapterLink>();

  const push = (href: string | undefined, text: string | undefined) => {
    if (!href) return;
    const key = href.trim();
    if (!key) return;
    const display = (text ?? "").trim();
    if (!found.has(key)) {
      found.set(key, { href: key, text: display });
    }
  };

  CHAPTER_LINK_SELECTORS.forEach((selector) => {
    $(selector)
      .toArray()
      .forEach((el) => {
        const href = $(el).attr("href");
        const text = $(el).text();
        push(href, text);
      });
  });

  // Fallback: các link chứa từ khoá "chuong"/"chapter"
  if (found.size === 0) {
    $("a")
      .toArray()
      .forEach((el) => {
        const href = $(el).attr("href") ?? "";
        const lower = href.toLowerCase();
        if (
          lower.includes("chuong") ||
          lower.includes("chapter") ||
          lower.includes("chap-")
        ) {
          push(href, $(el).text());
        }
      });
  }

  return Array.from(found.values());
}

const INDEX_REGEXPS = [
  /chương\s*(\d+)/i,
  /chuong\s*(\d+)/i,
  /chapter\s*(\d+)/i,
  /chap(?:ter)?\s*(\d+)/i,
  /(?:^|[^\d])(\d+)(?:$|[^\d])/,
];

function guessIndex(text: string, pathname: string): number | null {
  for (const re of INDEX_REGEXPS) {
    const match = re.exec(text);
    if (match && match[1]) return Number(match[1]);
  }

  const pathMatch = /(\d+)(?!.*\d)/.exec(pathname);
  if (pathMatch && pathMatch[1]) return Number(pathMatch[1]);

  return null;
}

function extractSeriesMeta(
  $: CheerioAPI
): { slug: string; total: number } | null {
  const scripts = $("script")
    .map((_, el) => $(el).html() ?? "")
    .get();

  for (const content of scripts) {
    if (!content || content.length < 20) continue;
    const slugMatch = content.match(/"url_story":"([^"]+)"/);
    const totalMatch = content.match(/"total_chap":("?)(\d+)\1/);
    if (slugMatch && totalMatch) {
      const slug = slugMatch[1]?.trim();
      const total = Number(totalMatch[2] ?? 0);
      if (slug && Number.isFinite(total) && total > 0) {
        return { slug, total };
      }
    }
  }
  return null;
}

function extractBuildId(html: string): string | null {
  const patterns = [
    /"buildId":"([a-zA-Z0-9-_]+)"/,
    /\"buildId\":\"([a-zA-Z0-9-_]+)\"/,
    /\"b\":\"([a-zA-Z0-9-_]+)\"/,
  ];
  for (const re of patterns) {
    const match = re.exec(html);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function fetchNextData(
  origin: string,
  buildId: string,
  path: string
): Promise<any | null> {
  const safePath = path.replace(/^\/+/, "");
  const url = `${origin}/_next/data/${buildId}/${safePath}.json`;
  try {
    const res = await request(url, {
      method: "GET",
      headers: { "User-Agent": "NovelBot/1.0 (+contact@example.com)" },
    });
    if (res.statusCode >= 400) return null;
    const text = await res.body.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function unwrapPageProps(data: any): any {
  if (!data || typeof data !== "object") return null;
  if (data.pageProps) return data.pageProps;
  if (data.props?.pageProps) return data.props.pageProps;
  if (data.data?.pageProps) return data.data.pageProps;
  if (Array.isArray(data)) {
    for (const item of data) {
      const nested = unwrapPageProps(item);
      if (nested) return nested;
    }
  }
  return null;
}

function deepFind(
  root: any,
  predicate: (value: any, key?: string) => boolean,
  visited = new Set<any>()
): any {
  if (!root || typeof root !== "object") return null;
  if (visited.has(root)) return null;
  visited.add(root);

  if (Array.isArray(root)) {
    for (const item of root) {
      const found = deepFind(item, predicate, visited);
      if (found !== null && found !== undefined) return found;
    }
    return null;
  }

  for (const [key, value] of Object.entries(root)) {
    if (predicate(value, key)) return value;
  }

  for (const value of Object.values(root)) {
    if (typeof value === "object" && value) {
      const found = deepFind(value, predicate, visited);
      if (found !== null && found !== undefined) return found;
    }
  }
  return null;
}

function looksLikeStoryDetail(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj);
  return (
    keys.includes("name") &&
    keys.includes("slug") &&
    (keys.includes("description") || keys.some((k) => /author/i.test(k)))
  );
}

function looksLikeChapterNode(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj);
  if (keys.includes("chapter") || keys.includes("chapterNumber")) return true;
  if (keys.includes("slug") && /chuong|chapter/i.test(String(obj.slug))) return true;
  if (keys.includes("chapter_slug")) return true;
  if (keys.includes("link") && /chuong|chapter/i.test(String(obj.link))) return true;
  return false;
}

function findChaptersArray(root: any): any[] | null {
  const found = deepFind(
    root,
    (value) => Array.isArray(value) && value.some((item) => looksLikeChapterNode(item))
  );
  return Array.isArray(found) ? found : null;
}

function findChapterDetail(root: any): any {
  return deepFind(root, (value, key) => {
    if (!value || typeof value !== "object") return false;
    if (key === "chapterDetail" || key === "chapter") return true;
    const keys = Object.keys(value);
    return keys.some((k) =>
      ["chapterContent", "chapter_content", "content", "content_html"].includes(k)
    );
  });
}

function findRichContent(root: any): string | null {
  const found = deepFind(root, (value) => {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    return trimmed.length > 40 && /<p|<div|<br/iu.test(trimmed);
  });
  return typeof found === "string" ? found : null;
}

@Injectable()
export class CrawlWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrawlWorker.name);
  private seriesWorker?: Worker;
  private chapterWorker?: Worker;
  private seriesEvents?: QueueEvents;
  private chapterEvents?: QueueEvents;

  constructor(
    private readonly ds: DataSource,
    private readonly queue: CrawlQueue
  ) {}

  onModuleInit() {
    const connection = {
      host: process.env.REDIS_HOST ?? "localhost",
      port: +(process.env.REDIS_PORT ?? 6379),
    };

    this.seriesWorker = new Worker(
      "crawl-series",
      async (job) => {
        const { sourceId, extSeriesId, url } = job.data as {
          sourceId: string;
          extSeriesId: string;
          url: string;
        };

        await sleep(jitter());

        const res = await request(url, {
          method: "GET",
          headers: { "User-Agent": "NovelBot/1.0 (+contact@example.com)" },
        });
        if (res.statusCode >= 400)
          throw new Error(`Series fetch ${url} failed ${res.statusCode}`);
        const html = await res.body.text();
        const $ = loadHtml(html);
        const origin = new URL(url).origin;
        const buildId = extractBuildId(html);
        const seriesMeta = extractSeriesMeta($);
        const slugPath =
          seriesMeta?.slug ?? new URL(url).pathname.replace(/^\/+|\/+$/g, "");

        let nextData: any | null = null;
        if (buildId && slugPath) {
          nextData = await fetchNextData(origin, buildId, slugPath);
        }
        const pageProps = unwrapPageProps(nextData);
        const storyDetail = pageProps && deepFind(pageProps, looksLikeStoryDetail);
        const chaptersFromData = pageProps ? findChaptersArray(pageProps) : null;

        // Parser tuỳ nguồn: ví dụ
        const title =
          storyDetail?.name ||
          storyDetail?.title ||
          $("h1").first().text().trim();
        const authorName =
          storyDetail?.authorName ||
          storyDetail?.author_name ||
          storyDetail?.author?.name ||
          $('a[rel="author"]').first().text().trim() ||
          $(".author").first().text().trim();
        const coverUrl =
          storyDetail?.thumbnail ||
          storyDetail?.image ||
          storyDetail?.poster ||
          $("img.cover").attr("src") ||
          $("meta[property='og:image']").attr("content");
        const description =
          storyDetail?.description ||
          storyDetail?.desc ||
          $("#gioi-thieu-truyen p").text().trim();

        const { seriesId } = await upsertSeries(this.ds, {
          title,
          authorName,
          coverUrl,
          sourceId,
          extSeriesId,
          url,
          description,
        });

        // Lấy danh sách chương
        const rawLinks = collectChapterLinks($);

        const chapters: Array<{
          extChapterId: string;
          url: string;
          indexNo: number;
          title?: string;
        }> = [];

        rawLinks.forEach((link, idx) => {
          try {
            const abs = new URL(link.href, url);
            const extChapterId = abs.pathname + abs.search;
            const titleText = link.text?.trim();
            const idxFromText =
              guessIndex(titleText ?? "", abs.pathname) ?? idx + 1;
            chapters.push({
              extChapterId,
              url: abs.toString(),
              indexNo: idxFromText > 0 ? idxFromText : idx + 1,
              title: titleText,
            });
          } catch {
            // bỏ qua link hỏng
          }
        });

        if (Array.isArray(chaptersFromData)) {
          chaptersFromData.forEach((item: any, idx: number) => {
            const rawSlug =
              item?.slug ||
              item?.chapter_slug ||
              item?.chapterSlug ||
              item?.link ||
              item?.url;
            if (!rawSlug) return;
            try {
              let relative = String(rawSlug).trim();
              if (/^https?:/i.test(relative)) {
                const abs = new URL(relative);
                relative = abs.pathname + abs.search;
              }
              relative = relative.replace(/^\/+/, "");
              const base = slugPath.replace(/\/+$/, "");
              if (!relative.startsWith(base)) {
                relative = `${base}/${relative}`;
              }
              const abs = new URL(`/${relative.replace(/^\/+/, "")}`, origin);
              const extChapterId = abs.pathname + abs.search;
              const indexCandidate =
                item?.chapterNumber ??
                item?.chapter ??
                item?.index ??
                guessIndex(String(item?.name ?? item?.title ?? ""), abs.pathname) ??
                idx + 1;
              chapters.push({
                extChapterId,
                url: abs.toString(),
                indexNo: Number(indexCandidate) > 0 ? Number(indexCandidate) : idx + 1,
                title:
                  item?.name ||
                  item?.title ||
                  item?.chapterName ||
                  item?.chapter_title,
              });
            } catch {
              // ignore invalid entry
            }
          });
        }

        // Sắp xếp theo index rồi dedupe
        const seen = new Set<string>();
        const normalized = chapters
          .sort((a, b) => a.indexNo - b.indexNo)
          .filter((ch) => {
            if (seen.has(ch.extChapterId)) return false;
            seen.add(ch.extChapterId);
            return true;
          })
          .map((ch, i) => ({
            ...ch,
            indexNo:
              Number.isFinite(ch.indexNo) && ch.indexNo > 0 ? ch.indexNo : i + 1,
          }));

        if (seriesMeta) {
          const slugBase = seriesMeta.slug.replace(/^\/*|\/*$/g, "");
          const seenIds = new Set(normalized.map((ch) => ch.extChapterId));
          for (let i = 1; i <= seriesMeta.total; i++) {
            let fallbackUrl: URL | null = null;
            try {
              fallbackUrl = new URL(`/${slugBase}/chuong-${i}`, origin);
            } catch {
              fallbackUrl = null;
            }
            if (!fallbackUrl) continue;
            const extChapterId = fallbackUrl.pathname + fallbackUrl.search;
            if (seenIds.has(extChapterId)) continue;
            normalized.push({
              extChapterId,
              url: fallbackUrl.toString(),
              indexNo: i,
              title: undefined,
            });
            seenIds.add(extChapterId);
          }

          if (normalized.length < seriesMeta.total) {
            this.logger.warn(
              `Only ${normalized.length}/${seriesMeta.total} chapters discovered for series ${seriesId} (${extSeriesId})`
            );
          }
        }

        if (normalized.length === 0) {
          this.logger.warn(
            `No chapters parsed for series ${seriesId} (${extSeriesId})`
          );
        }

        normalized.sort((a, b) => a.indexNo - b.indexNo);

        if (normalized.length) {
          try {
            const chunkSize = Math.max(
              50,
              Number(process.env.CRAWL_CHAPTER_CHUNK ?? 200)
            );
            for (let i = 0; i < normalized.length; i += chunkSize) {
              const slice = normalized.slice(i, i + chunkSize);
              await this.queue.chapterQueue.addBulk(
                slice.map((ch) => ({
                  name: "chapter",
                  data: {
                    sourceId,
                    seriesId,
                    extChapterId: ch.extChapterId,
                    url: ch.url,
                    indexNo: ch.indexNo,
                    title: ch.title,
                    buildId,
                    storyPath: slugPath,
                  },
                  opts: {
                    jobId: `chapter_${sourceId}_${ch.extChapterId}`,
                    removeOnComplete: true,
                    removeOnFail: true,
                  },
                }))
              );
            }
            this.logger.log(
              `Enqueued ${normalized.length} chapter jobs for series ${seriesId}`
            );
          } catch (error) {
            this.logger.warn(
              `enqueue chapters failed series=${seriesId}: ${error}`
            );
          }
        }

        return {
          seriesId,
          chaptersCount: normalized.length,
          chapters: normalized,
        };
      },
      { connection }
    );

    this.chapterWorker = new Worker(
      "crawl-chapter",
      async (job) => {
        const { sourceId, extChapterId, url, seriesId, indexNo, buildId, storyPath } = job
          .data as {
          sourceId: string;
          extChapterId: string;
          url: string;
          seriesId: string;
          indexNo?: number;
          buildId?: string;
          storyPath?: string;
        };

        await sleep(jitter());

        const res = await request(url, {
          method: "GET",
          headers: { "User-Agent": "NovelBot/1.0 (+contact@example.com)" },
        });
        if (res.statusCode >= 400)
          throw new Error(`Chapter fetch ${url} failed ${res.statusCode}`);
        const html = await res.body.text();
        const $ = loadHtml(html);

        let chapterTitle =
          $("h1").first().text().trim() ||
          $(".chapter-title").first().text().trim();
        let contentHtml =
          $(".chapter-content").html() ??
          $("#chapter-content").html() ??
          $("article").html() ??
          "";

        const origin = new URL(url).origin;
        const chapterPath = extChapterId.replace(/^\/+/, "");
        let nextChapterProps: any | null = null;
        if (buildId && storyPath) {
          const base = storyPath.replace(/^\/+|\/+$/g, "");
          let rel = chapterPath;
          if (!rel.startsWith(base)) rel = `${base}/${rel}`;
          const chapterData = await fetchNextData(origin, buildId, rel).catch(() => null);
          nextChapterProps = unwrapPageProps(chapterData);
        }

        if (nextChapterProps) {
          const detail = findChapterDetail(nextChapterProps);
          if (detail) {
            chapterTitle =
              detail?.name ||
              detail?.title ||
              detail?.chapterName ||
              detail?.chapter_title ||
              chapterTitle;
            contentHtml =
              detail?.chapterContent ||
              detail?.chapter_content ||
              detail?.content_html ||
              detail?.content ||
              contentHtml;
          }
          if (!contentHtml) {
            const rich = findRichContent(nextChapterProps);
            if (rich) contentHtml = rich;
          }
        }

        const contentText = normalizeHtmlToText(contentHtml);

        await upsertChapter(this.ds, {
          sourceId,
          extChapterId,
          seriesId,
          indexNo,
          title: chapterTitle || job.data?.title,
          content: contentText,
          extUrl: url,
        });
      },
      { connection }
    );

    // Optional: events log
    this.seriesEvents = new QueueEvents("crawl-series", { connection });
    this.seriesEvents.on("failed", ({ jobId, failedReason }) =>
      this.logger.warn(`series failed ${jobId} ${failedReason}`)
    );
    this.chapterEvents = new QueueEvents("crawl-chapter", { connection });
    this.chapterEvents.on("failed", ({ jobId, failedReason }) =>
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
