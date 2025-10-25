import * as cheerio from "cheerio";
import { CrawlAdapter, SeriesParseResult } from "./types";
import { MAX_CHAPTER_PREFETCH } from "../config";

/** Chuẩn hoá URL tuyệt đối */
export function abs(base: string, href?: string | null): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/** Rút liên kết series từ trang thể loại của truyenfull.vision */
export function extractSeriesLinksFromCategory(
  html: string,
  baseUrl: string
): string[] {
  const $ = cheerio.load(html);
  const set = new Set<string>();

  $("a[href]").each((_, el) => {
    const u = abs(baseUrl, $(el).attr("href") || "");
    if (!u) return;
    try {
      const { hostname, pathname } = new URL(u);
      // Host hợp lệ
      const isHostOk =
        /truyenfull\.vision$/i.test(hostname) || /truyenfull/i.test(hostname);
      // Path dạng "/<slug>[/]" (không /the-loai/, không /chuong-n/)
      const isSeriesPath =
        /^\/[^/]+\/?$/i.test(pathname) &&
        !/\/(the-loai|chuong-\d+)\/?$/i.test(pathname);

      if (isHostOk && isSeriesPath) set.add(u);
    } catch {
      /* noop */
    }
  });

  return Array.from(set);
}

/** Trích meta cơ bản từ trang series */
export function parseSeriesMeta(html: string) {
  const $ = cheerio.load(html);
  const pick = (xs: (string | undefined | null)[]) =>
    xs.map((s) => (s || "").trim()).find(Boolean) || "";

  const title =
    pick([
      $("h1").first().text(),
      $(".book-title, .title, .truyen-title").first().text(),
      $('meta[property="og:title"]').attr("content"),
      $('meta[name="title"]').attr("content"),
      $("title").text()?.split("|")[0],
    ]) || "";

  const description =
    pick([
      $(".desc, .book-desc, .mota, .description, #gioi-thieu").first().text(),
      $('[itemprop="description"]').first().text(),
      $('meta[name="description"]').attr("content"),
    ]) || null;

  const cover =
    $(".book img, .cover img, .book-cover img, img.cover")
      .first()
      .attr("src") ||
    $('meta[property="og:image"]').attr("content") ||
    null;

  const bodyText = $("body").text() || "";
  const status = /\b(hoàn|full|completed)\b/i.test(bodyText)
    ? "completed"
    : "ongoing";

  return { title, description, cover, status };
}

/** Tìm link chương 1 nếu có trên trang series */
export function findFirstChapterUrl(
  html: string,
  seriesUrl: string
): string | null {
  const $ = cheerio.load(html);

  const href =
    $(
      "a:contains('Chương 1'), a:contains('Đọc từ đầu'), a:contains('ĐỌC TỪ ĐẦU')"
    )
      .first()
      .attr("href") ||
    $(".list-chapter a[href], .chapter-list a[href], .list-chapters a[href]")
      .first()
      .attr("href") ||
    $("a[href*='chuong-1']").first().attr("href");

  return abs(seriesUrl, href || "");
}

/** Fallback: tự dựng URL chương 1 theo pattern vision */
export function buildChapter1Url(seriesUrl: string): string | null {
  try {
    const u = new URL(seriesUrl);
    if (!/^\/[^/]+\/?$/i.test(u.pathname)) return null; // không phải root slug
    if (!u.pathname.endsWith("/")) u.pathname += "/";
    u.pathname = `${u.pathname}chuong-1/`;
    return u.toString();
  } catch {
    return null;
  }
}

export const truyenFullAdapter: CrawlAdapter = {
  extractCategory(html: string, pageUrl: string) {
    return {
      seriesUrls: extractSeriesLinksFromCategory(html, pageUrl),
    };
  },
  parseSeries(html: string, pageUrl: string): SeriesParseResult {
    const meta = parseSeriesMeta(html);
    const firstChapter = findFirstChapterUrl(html, pageUrl);
    const fallbackChapter = buildChapter1Url(pageUrl);
    const chapterUrls: string[] = [];

    const $ = cheerio.load(html);
    $(".list-chapter a[href], .chapter-list a[href], .list-chapters a[href]")
      .slice(0, MAX_CHAPTER_PREFETCH)
      .each((_, el) => {
        const href = abs(pageUrl, $(el).attr("href") || "");
        if (href) chapterUrls.push(href);
      });

    const extSeriesId = (() => {
      try {
        const u = new URL(pageUrl);
        return u.pathname.replace(/^\/+|\/+$/g, "");
      } catch {
        return undefined;
      }
    })();

    const hasMoreChapters =
      $(".list-chapter .pagination a, .chapter-list .pagination a")
        .length > 0;

    return {
      extSeriesId,
      canonicalUrl: pageUrl,
      title: meta.title,
      description: meta.description,
      coverImage: meta.cover,
      status: meta.status as "completed" | "ongoing" | "hiatus",
      firstChapterUrl: firstChapter || fallbackChapter,
      chapterUrls,
      hasMoreChapters,
    };
  },
  parseChapter(html: string, pageUrl: string) {
    const $ = cheerio.load(html);
    const content =
      $("#chapter-c, .chapter-c, .chapter-content, .content, .entry-content")
        .first()
        .html()
        ?.trim() || null;
    const title =
      $(".chapter-title, h1, h2.title").first().text().trim() ||
      $("[itemprop='headline']").first().text().trim() ||
      null;

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
      /* ignore */
    }

    return {
      index,
      title: title ?? undefined,
      contentHtml: content ?? undefined,
      nextUrl: abs(pageUrl, nextHref || undefined) ?? null,
    };
  },
};
