import * as cheerio from "cheerio";
import { CrawlAdapter, AdapterResolveContext } from "./types";
import { truyenFullAdapter } from "./truyenfull.adapter";
import { truyenChuHayAdapter } from "./truyenchuhay.adapter";
import { meTruyenCvAdapter } from "./metruyencv.adapter";
import { genericExtractSeriesLinks } from "../utils";
import { MAX_CHAPTER_PREFETCH } from "../config";

const defaultParseSeries: CrawlAdapter["parseSeries"] = (html, pageUrl) => {
  const $ = cheerio.load(html);
  const pick = (arr: Array<string | undefined | null>) =>
    arr.map((s) => (s || "").trim()).find(Boolean) || undefined;

  const title = pick([
    $("h1").first().text(),
    $(".book-title, .title, .truyen-title").first().text(),
    $('meta[property="og:title"]').attr("content"),
    $('meta[name="title"]').attr("content"),
  ]);

  const description =
    pick([
      $(".desc, .book-desc, .description, #gioi-thieu").first().text(),
      $('[itemprop="description"]').first().text(),
      $('meta[name="description"]').attr("content"),
    ]) ?? null;

  const cover =
    $(".book img, .cover img, .book-cover img")
      .first()
      .attr("src") ||
    $('meta[property="og:image"]').attr("content") ||
    null;

  const chapterUrls: string[] = [];
  $(".list-chapter a[href], .chapter-list a[href], a.chapter-item[href]")
    .slice(0, MAX_CHAPTER_PREFETCH)
    .each((_, el) => {
      const href = $(el).attr("href") || "";
      try {
        chapterUrls.push(new URL(href, pageUrl).toString());
      } catch {
        /* ignore */
      }
    });

  let first: string | null = null;
  if (chapterUrls.length > 0) first = chapterUrls[0];
  else {
    const href =
      $("a:contains('Chương 1'), a:contains('ĐỌC TỪ ĐẦU'), a:contains('Đọc từ đầu')")
        .first()
        .attr("href") ||
      null;
    if (href) {
      try {
        first = new URL(href, pageUrl).toString();
      } catch {
        /* noop */
      }
    }
  }

  let extSeriesId: string | undefined;
  try {
    extSeriesId = new URL(pageUrl).pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    /* noop */
  }

  return {
    extSeriesId,
    canonicalUrl: pageUrl,
    title,
    description,
    coverImage: cover,
    firstChapterUrl: first,
    chapterUrls,
    hasMoreChapters: $(".pagination a").length > 0,
  };
};

const defaultParseChapter: CrawlAdapter["parseChapter"] = (html, pageUrl) => {
  const $ = cheerio.load(html);
  const content =
    $("#chapter-c, .chapter-c, .chapter-content, .content, .entry-content")
      .first()
      .html()
      ?.trim() ||
    undefined;
  const title =
    $(".chapter-title, h1, h2.title").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    undefined;
  const nextHref =
    $("a[rel='next']").attr("href") ||
    $("a:contains('Chương sau'), a:contains('Chương tiếp')").attr("href") ||
    $(".chapter-nav a[rel='next']").attr("href") ||
    $("a.next-chap[href]").attr("href") ||
    null;

  let index: number | undefined;
  try {
    const { pathname } = new URL(pageUrl);
    const m = pathname.match(/\/chuong-(\d+)\/?$/i);
    if (m) index = parseInt(m[1], 10);
  } catch {
    /* noop */
  }

  let nextUrl: string | null = null;
  if (nextHref) {
    try {
      nextUrl = new URL(nextHref, pageUrl).toString();
    } catch {
      nextUrl = null;
    }
  }

  return {
    index,
    title,
    contentHtml: content,
    nextUrl,
  };
};

const DEFAULT_ADAPTER: CrawlAdapter = {
  extractCategory(html, pageUrl) {
    return { seriesUrls: genericExtractSeriesLinks(html, pageUrl) };
  },
  parseSeries: defaultParseSeries,
  parseChapter: defaultParseChapter,
};

const ADAPTERS: Array<{
  match: (ctx: AdapterResolveContext) => boolean;
  adapter: CrawlAdapter;
}> = [
  {
    match: ({ sourceId, sourceName, baseUrl }) => {
      const values = [sourceId, sourceName, baseUrl]
        .map((v) => v?.toLowerCase() ?? "");
      return values.some((value) => value?.includes("truyenfull"));
    },
    adapter: truyenFullAdapter,
  },
  {
    match: ({ sourceId, sourceName, baseUrl }) => {
      const values = [sourceId, sourceName, baseUrl]
        .map((v) => v?.toLowerCase() ?? "");
      return values.some((value) => value?.includes("truyenchuhay"));
    },
    adapter: truyenChuHayAdapter,
  },
  {
    match: ({ sourceId, sourceName, baseUrl }) => {
      const values = [sourceId, sourceName, baseUrl]
        .map((v) => v?.toLowerCase() ?? "");
      return values.some((value) => value?.includes("metruyencv"));
    },
    adapter: meTruyenCvAdapter,
  },
];

export function resolveAdapter(ctx: AdapterResolveContext): CrawlAdapter {
  for (const item of ADAPTERS) {
    if (item.match(ctx)) return item.adapter;
  }
  return DEFAULT_ADAPTER;
}

export * from "./types";
