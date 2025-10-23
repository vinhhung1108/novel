import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { Worker, QueueEvents } from "bullmq";
import { request, Agent } from "undici";
import { inspect } from "node:util";
import { load as loadHtml, CheerioAPI } from "cheerio";
import {
  setDefaultResultOrder,
  setServers,
  lookup as dnsLookup,
} from "node:dns";

import { CrawlQueue } from "./crawl.queue";
import { normalizeHtmlToText } from "./normalize";
import { upsertSeries, upsertChapter } from "./writers";

/* ------------------------- helpers / env ------------------------- */

const toInt = (v: string | undefined, d: number) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

const SERIES_CONCURRENCY = toInt(process.env.CRAWL_SERIES_CONCURRENCY, 2);
const CHAPTER_CONCURRENCY = toInt(process.env.CRAWL_CHAPTER_CONCURRENCY, 3);
const JITTER_MAX_MS = toInt(process.env.CRAWL_JITTER_MAX_MS, 400);

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
function jitter() {
  return Math.floor(Math.random() * (JITTER_MAX_MS + 1));
}

const REQUEST_HEADERS_TIMEOUT_MS = toInt(
  process.env.CRAWL_HEADERS_TIMEOUT_MS,
  10_000
);
const REQUEST_BODY_TIMEOUT_MS = toInt(
  process.env.CRAWL_BODY_TIMEOUT_MS,
  20_000
);
const FETCH_ATTEMPTS = Math.max(1, toInt(process.env.CRAWL_FETCH_ATTEMPTS, 2));
const RETRY_DELAY_MS = toInt(process.env.CRAWL_FETCH_RETRY_DELAY_MS, 1_500);

const DNS_SERVERS = (process.env.CRAWL_DNS_SERVERS ?? "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

const HOST_MAP = new Map(
  (process.env.CRAWL_HOST_MAP ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, ip] = entry.split("=");
      return [host?.trim(), ip?.trim()] as const;
    })
    .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1]))
);

if (DNS_SERVERS.length) {
  try {
    setServers(DNS_SERVERS);
  } catch (e) {
    console.warn(
      "[CrawlWorker] setServers failed:",
      (e as Error)?.message ?? e
    );
  }
}
try {
  setDefaultResultOrder("ipv4first");
} catch (e) {
  console.warn(
    "[CrawlWorker] setDefaultResultOrder failed:",
    (e as Error)?.message ?? e
  );
}

const overrideAgent =
  HOST_MAP.size > 0
    ? new Agent({
        connect: {
          lookup(hostname, options, callback) {
            const override = HOST_MAP.get(hostname);
            if (override) {
              callback(null, override, 4);
              return;
            }
            return dnsLookup(hostname, options, callback);
          },
        },
      })
    : undefined;

function shouldRetryStatus(code: number): boolean {
  return code === 429 || code >= 500;
}

function extractErrorInfo(error: unknown): { message: string; stack?: string } {
  if (!error) {
    return {
      message:
        "Falsy error thrown (type=undefined); network may be blocked or request aborted by environment.",
    };
  }
  if (error instanceof Error) {
    const extras: string[] = [];
    const any = error as any;
    if (any?.code) extras.push(`code=${any.code}`);
    if (any?.statusCode) extras.push(`status=${any.statusCode}`);
    if (any?.errno) extras.push(`errno=${any.errno}`);
    if (any?.cause) extras.push(`cause=${inspect(any.cause, { depth: 3 })}`);
    return {
      message: `${error.name}: ${error.message}${
        extras.length ? " | " + extras.join(" ") : ""
      }`,
      stack: error.stack,
    };
  }
  const inspected = inspect(error, { depth: 5 }) ?? "";
  return { message: inspected || "Unknown error" };
}

async function fetchHtmlWithRetry(
  url: string,
  logger: Logger,
  context: string,
  attempts = FETCH_ATTEMPTS
): Promise<{ html: string; statusCode: number }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      logger.debug(`[${context}] GET ${url} attempt ${attempt}/${attempts}`);
      const res = await request(url, {
        method: "GET",
        headers: { "User-Agent": "NovelBot/1.0 (+contact@example.com)" },
        headersTimeout: REQUEST_HEADERS_TIMEOUT_MS,
        bodyTimeout: REQUEST_BODY_TIMEOUT_MS,
        dispatcher: overrideAgent,
      });
      const statusCode = res.statusCode;
      const html = await res.body.text();
      logger.debug(`[${context}] HTTP ${statusCode} len=${html.length}`);
      if (statusCode >= 400) {
        if (attempt < attempts && shouldRetryStatus(statusCode)) {
          await sleep(RETRY_DELAY_MS + jitter());
          continue;
        }
        throw new Error(`[${context}] HTTP ${statusCode} for ${url}`);
      }
      return { html, statusCode };
    } catch (err) {
      lastError = err;
      const { message } = extractErrorInfo(err);
      if (attempt >= attempts) {
        throw err instanceof Error ? err : new Error(message);
      }
      await sleep(RETRY_DELAY_MS + jitter());
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error(extractErrorInfo(lastError).message);
}

/* ------------------------- HTML/Data extractors ------------------------- */

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

type ChapterLink = { href: string; text: string };

function collectChapterLinks($: CheerioAPI): ChapterLink[] {
  const found = new Map<string, ChapterLink>();
  const push = (href?: string, text?: string) => {
    if (!href) return;
    const key = href.trim();
    if (!key || key === "#" || key.includes("#danh-sach-chuong")) return;
    const display = (text ?? "").trim();
    if (!found.has(key)) found.set(key, { href: key, text: display });
  };

  CHAPTER_LINK_SELECTORS.forEach((sel) => {
    $(sel)
      .toArray()
      .forEach((el) => push($(el).attr("href"), $(el).text()));
  });

  if (found.size === 0) {
    $("a")
      .toArray()
      .forEach((el) => {
        const href = ($(el).attr("href") ?? "").trim();
        const lower = href.toLowerCase();
        if (
          href &&
          !href.includes("#") &&
          (lower.includes("chuong") ||
            lower.includes("chapter") ||
            lower.includes("chap-"))
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
    const m = re.exec(text);
    if (m?.[1]) return Number(m[1]);
  }
  const pathMatch = /(\d+)(?!.*\d)/.exec(pathname);
  return pathMatch?.[1] ? Number(pathMatch[1]) : null;
}

// next.js helpers
function extractBuildId(html: string): string | null {
  const patterns = [
    /"buildId":"([a-zA-Z0-9-_]+)"/,
    /\"buildId\":\"([a-zA-Z0-9-_]+)\"/,
    /\"b\":\"([a-zA-Z0-9-_]+)\"/,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) return m[1];
  }
  return null;
}
async function fetchNextData(
  origin: string,
  buildId: string,
  path: string
): Promise<any | null> {
  const safe = path.replace(/^\/+/, "");
  const url = `${origin}/_next/data/${buildId}/${safe}.json`;
  try {
    const res = await request(url, {
      method: "GET",
      headers: { "User-Agent": "NovelBot/1.0" },
      headersTimeout: REQUEST_HEADERS_TIMEOUT_MS,
      bodyTimeout: REQUEST_BODY_TIMEOUT_MS,
      dispatcher: overrideAgent,
    });
    if (res.statusCode >= 400) return null;
    return JSON.parse(await res.body.text());
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
    for (const it of data) {
      const nested = unwrapPageProps(it);
      if (nested) return nested;
    }
  }
  return null;
}
function deepFind(
  root: any,
  pred: (value: any, key?: string) => boolean,
  seen = new Set<any>()
): any {
  if (!root || typeof root !== "object") return null;
  if (seen.has(root)) return null;
  seen.add(root);
  if (Array.isArray(root)) {
    for (const v of root) {
      const f = deepFind(v, pred, seen);
      if (f !== null && f !== undefined) return f;
    }
    return null;
  }
  for (const [k, v] of Object.entries(root)) {
    if (pred(v, k)) return v;
  }
  for (const v of Object.values(root)) {
    if (v && typeof v === "object") {
      const f = deepFind(v, pred, seen);
      if (f !== null && f !== undefined) return f;
    }
  }
  return null;
}
function looksLikeStoryDetail(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj);
  return keys.includes("name") && keys.includes("slug");
}
function findChapterDetail(root: any): any {
  return deepFind(root, (value, key) => {
    if (!value || typeof value !== "object") return false;
    if (key === "chapterDetail" || key === "chapter") return true;
    const keys = Object.keys(value);
    return keys.some((k) =>
      ["chapterContent", "chapter_content", "content", "content_html"].includes(
        k
      )
    );
  });
}
function findRichContent(root: any): string | null {
  const found = deepFind(
    root,
    (v) => typeof v === "string" && /<p|<div|<br/iu.test(v.trim())
  );
  return typeof found === "string" ? found : null;
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
      if (slug && Number.isFinite(total) && total > 0) return { slug, total };
    }
  }
  return null;
}

/* -------- extra: robust chapter content extraction from <script> -------- */

const HTMLISH = /<\/?[a-z][\s\S]*>/i;

function htmlEntityDecode(str: string): string {
  // decode the most common sequences quickly
  return str
    .replace(/\\u003C/g, "<")
    .replace(/\\u003E/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function tryExtractFromScripts($: CheerioAPI): {
  title?: string | null;
  contentHtml?: string | null;
} {
  const scripts = $("script")
    .map((_, el) => $(el).html() ?? "")
    .get()
    .filter(Boolean);

  // 1) Thử parse __NEXT_DATA__ / data JSON trực tiếp
  for (const s of scripts) {
    try {
      // lấy JSON object ở trong nếu script chỉ chứa JSON
      const trimmed = s.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        const obj = JSON.parse(trimmed);
        const pageProps = unwrapPageProps(obj) ?? obj;
        const detail = findChapterDetail(pageProps);
        const rich = findRichContent(pageProps);
        const title =
          detail?.name ||
          detail?.title ||
          detail?.chapterName ||
          detail?.chapter_title ||
          null;
        const contentHtmlRaw =
          detail?.chapterContent ||
          detail?.chapter_content ||
          detail?.content_html ||
          detail?.content ||
          rich ||
          null;
        if (
          typeof contentHtmlRaw === "string" &&
          HTMLISH.test(contentHtmlRaw)
        ) {
          return { title, contentHtml: htmlEntityDecode(contentHtmlRaw) };
        }
      }
    } catch {
      // ignore JSON parse error
    }
  }

  // 2) Dùng regex săn field nội dung string trong script text
  const keys = ["chapterContent", "chapter_content", "content_html", "content"];
  for (const s of scripts) {
    for (const key of keys) {
      const re = new RegExp(`"${key}"\\s*:\\s*"(.*?)"`, "s");
      const m = re.exec(s);
      if (m?.[1]) {
        const raw = m[1];
        const decoded = htmlEntityDecode(raw.replace(/\\"/g, '"'));
        if (HTMLISH.test(decoded)) {
          // thử lấy title nếu có
          const t =
            /"chapter(?:Name|_title|Title|name|title)"\s*:\s*"(.*?)"/s.exec(
              s
            )?.[1] ?? null;
          return {
            title: t ? htmlEntityDecode(t) : null,
            contentHtml: decoded,
          };
        }
      }
    }
  }
  return { title: null, contentHtml: null };
}

/* ----------------------------- Worker ----------------------------- */

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

    this.logger.log(
      `Init CrawlWorker with SERIES_CONCURRENCY=${SERIES_CONCURRENCY}, CHAPTER_CONCURRENCY=${CHAPTER_CONCURRENCY}`
    );

    /* ------------ series worker ------------ */
    this.seriesWorker = new Worker(
      "crawl-series",
      async (job) => {
        const { sourceId, extSeriesId, url } = job.data as {
          sourceId: string;
          extSeriesId?: string;
          url: string;
        };
        const context = `series ${sourceId}:${extSeriesId ?? new URL(url).pathname}`;
        try {
          await sleep(jitter());
          const { html } = await fetchHtmlWithRetry(url, this.logger, context);
          const $ = loadHtml(html);

          const origin = new URL(url).origin;
          const buildId = extractBuildId(html);
          const seriesMeta = extractSeriesMeta($);
          const slugPath =
            seriesMeta?.slug ?? new URL(url).pathname.replace(/^\/+|\/+$/g, "");

          // Lấy pageProps/storyDetail (nếu có)
          let pageProps: any = null;
          let storyDetail: any = null;
          if (buildId && slugPath) {
            const nextData = await fetchNextData(
              origin,
              buildId,
              slugPath
            ).catch(() => null);
            pageProps = unwrapPageProps(nextData);
            if (pageProps)
              storyDetail = deepFind(pageProps, looksLikeStoryDetail);
          }

          // Parse tiêu đề & mô tả fallback từ HTML
          const title =
            storyDetail?.name ||
            storyDetail?.title ||
            $("h1").first().text().trim();

          const description =
            storyDetail?.description ||
            storyDetail?.desc ||
            $("#gioi-thieu-truyen p").text().trim() ||
            $("meta[name='description']").attr("content") ||
            "";

          // Alias titles (nếu có)
          const altTitles: string[] | null = [
            storyDetail?.altTitle,
            storyDetail?.otherName,
            storyDetail?.aka,
          ]
            .filter(
              (v: unknown): v is string =>
                typeof v === "string" && v.trim().length > 0
            )
            .flatMap((v) => v.split(/[,;|｜]/).map((s) => s.trim()))
            .filter(Boolean);

          const { seriesId } = await upsertSeries(this.ds, {
            sourceId,
            extSeriesId: extSeriesId ?? slugPath,
            url,
            title,
            originalTitle: storyDetail?.originalTitle ?? null,
            description,
            languageCode: "vi",
            altTitles: altTitles?.length ? altTitles : null,
          });

          // Thu link chương
          const links = collectChapterLinks($);
          const chapters = links.map((lnk, i) => {
            const abs = new URL(lnk.href, url);
            const extChapterId = abs.pathname + abs.search;
            const idx = guessIndex(lnk.text ?? "", abs.pathname) ?? i + 1;
            return {
              extChapterId,
              url: abs.toString(),
              indexNo: Math.max(1, idx),
              title: lnk.text?.trim() || null,
            };
          });

          // Dedupe theo extChapterId + sort theo index
          const seen = new Set<string>();
          const normalized = chapters
            .filter((c) => {
              if (seen.has(c.extChapterId)) return false;
              seen.add(c.extChapterId);
              return true;
            })
            .sort((a, b) => a.indexNo - b.indexNo);

          // Enqueue theo chunk
          if (normalized.length) {
            const chunkSize = Math.max(
              50,
              Number(process.env.CRAWL_CHUNK_SIZE ?? 200)
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
              `Enqueued ${normalized.length} chapters for series ${seriesId}`
            );
          } else {
            this.logger.warn(`[${context}] no chapter links found`);
          }

          return { seriesId, chaptersCount: normalized.length };
        } catch (error) {
          const { message, stack } = extractErrorInfo(error);
          this.logger.error(`[${context}] failed: ${message}`, stack);
          throw error instanceof Error ? error : new Error(message);
        }
      },
      { connection, concurrency: SERIES_CONCURRENCY }
    );

    /* ------------ chapter worker ------------ */
    this.chapterWorker = new Worker(
      "crawl-chapter",
      async (job) => {
        const {
          sourceId,
          extChapterId,
          url,
          seriesId,
          indexNo,
          buildId,
          storyPath,
        } = job.data as {
          sourceId: string;
          extChapterId: string;
          url: string;
          seriesId: string;
          indexNo?: number;
          buildId?: string;
          storyPath?: string;
          title?: string | null;
        };
        const context = `chapter ${sourceId}:${extChapterId}`;
        try {
          await sleep(jitter());
          const { html } = await fetchHtmlWithRetry(url, this.logger, context);
          const $ = loadHtml(html);

          // Title & content từ HTML (bổ sung thêm selector phổ biến)
          let chapterTitle =
            $("h1").first().text().trim() ||
            $(".chapter-title").first().text().trim() ||
            $(".title-chapter").first().text().trim() ||
            job.data?.title ||
            null;

          let contentHtml =
            $(".chapter-content").html() ??
            $("#chapter-content").html() ??
            $("article .content").html() ??
            $("article").html() ??
            $(".reading__content").html() ??
            $("#reading-content").html() ??
            $("div[data-chapter-content]").html() ??
            null;

          // Nếu site dùng Next.js, thử lấy dữ liệu giàu
          if (buildId && storyPath) {
            const origin = new URL(url).origin;
            const base = storyPath.replace(/^\/+|\/+$/g, "");
            let rel = extChapterId.replace(/^\/+/, "");
            if (!rel.startsWith(base)) rel = `${base}/${rel}`;
            const chapterData = await fetchNextData(origin, buildId, rel).catch(
              () => null
            );
            const pageProps = unwrapPageProps(chapterData);
            if (pageProps) {
              const detail = findChapterDetail(pageProps);
              if (detail) {
                chapterTitle =
                  detail?.name ||
                  detail?.title ||
                  detail?.chapterName ||
                  detail?.chapter_title ||
                  chapterTitle;
                const candidate =
                  detail?.chapterContent ||
                  detail?.chapter_content ||
                  detail?.content_html ||
                  detail?.content ||
                  null;
                if (!contentHtml && typeof candidate === "string") {
                  contentHtml = candidate;
                }
              } else if (!contentHtml) {
                const rich = findRichContent(pageProps);
                if (rich) contentHtml = rich;
              }
            }
          }

          // Fallback mạnh: quét <script> để lấy content
          if (!contentHtml || !HTMLISH.test(contentHtml)) {
            const fromScripts = tryExtractFromScripts($);
            if (fromScripts.title && !chapterTitle)
              chapterTitle = fromScripts.title;
            if (fromScripts.contentHtml) contentHtml = fromScripts.contentHtml;
          }

          // Cuối cùng mới normalize
          const safeHtml = typeof contentHtml === "string" ? contentHtml : "";
          const contentText = normalizeHtmlToText(htmlEntityDecode(safeHtml));
          this.logger.debug(
            `[${context}] content length html=${safeHtml?.length ?? 0} text=${contentText.length}`
          );

          await upsertChapter(this.ds, {
            sourceId,
            extChapterId,
            seriesId,
            indexNo,
            title: chapterTitle,
            content: contentText,
            extUrl: url,
          });
        } catch (error) {
          const { message, stack } = extractErrorInfo(error);
          this.logger.error(`[${context}] failed: ${message}`, stack);
          throw error instanceof Error ? error : new Error(message);
        }
      },
      { connection, concurrency: CHAPTER_CONCURRENCY }
    );

    // Optional events
    this.seriesEvents = new QueueEvents("crawl-series", { connection });
    this.seriesEvents.on("failed", ({ jobId, failedReason }) =>
      this.logger.warn(`series failed ${jobId} ${failedReason ?? "unknown"}`)
    );

    this.chapterEvents = new QueueEvents("crawl-chapter", { connection });
    this.chapterEvents.on("failed", ({ jobId, failedReason }) =>
      this.logger.warn(`chapter failed ${jobId} ${failedReason ?? "unknown"}`)
    );
  }

  async onModuleDestroy() {
    const tasks: Array<Promise<unknown>> = [];
    if (this.seriesWorker) tasks.push(this.seriesWorker.close());
    if (this.chapterWorker) tasks.push(this.chapterWorker.close());
    if (this.seriesEvents) tasks.push(this.seriesEvents.close());
    if (this.chapterEvents) tasks.push(this.chapterEvents.close());
    if (tasks.length) await Promise.allSettled(tasks);
  }
}
