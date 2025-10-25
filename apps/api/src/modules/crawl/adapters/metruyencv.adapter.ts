import * as cheerio from "cheerio";
import { CrawlAdapter, SeriesParseResult, ChapterParseResult } from "./types";
import { MAX_CHAPTER_PREFETCH } from "../config";

function abs(base: string, href?: string | null): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

const CATEGORY_LINK_REGEX = /\/(truyen|book|tong-hop)\/[-a-z0-9]+/i;

function extractCategory(html: string, pageUrl: string) {
  const $ = cheerio.load(html);
  const set = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = abs(pageUrl, $(el).attr("href") || "");
    if (!href) return;
    try {
      const { hostname, pathname } = new URL(href);
      if (!/metruyencv\.com$/i.test(hostname)) return;
      if (!CATEGORY_LINK_REGEX.test(pathname)) return;
      if (/\/chuong-/i.test(pathname)) return;
      set.add(href);
    } catch {
      /* noop */
    }
  });

  return Array.from(set);
}

function parseSeries(html: string, pageUrl: string): SeriesParseResult {
  const $ = cheerio.load(html);

  const pick = (arr: Array<string | undefined | null>) =>
    arr.map((s) => (s || "").trim()).find(Boolean) || undefined;

  const title = pick([
    $("h1").first().text(),
    $(".book-title, .novel-title").first().text(),
    $('meta[property="og:title"]').attr("content"),
  ]);

  const description =
    pick([
      $(".book-desc, .description, [data-type='description']").first().text(),
      $('meta[name="description"]').attr("content"),
    ]) ?? null;

  const cover =
    $(".book-cover img, .novel-thumb img")
      .first()
      .attr("src") ||
    $('meta[property="og:image"]').attr("content") ||
    null;

  const statusText =
    $(".book-info .status, .novel-status")
      .first()
      .text()
      .trim()
      .toLowerCase() || "";
  const status = /full|hoàn|completed/.test(statusText)
    ? "completed"
    : "ongoing";

  const chapterUrls: string[] = [];
  $(
    "a[href*='/chuong-'], .chapter-list a[href], [data-type='chapter-list'] a[href]"
  )
    .slice(0, MAX_CHAPTER_PREFETCH)
    .each((_, el) => {
      const href = abs(pageUrl, $(el).attr("href") || "");
      if (href) chapterUrls.push(href);
    });

  let firstChapterUrl: string | null = null;
  if (chapterUrls.length > 0) {
    firstChapterUrl = chapterUrls[0];
  } else {
    const direct =
      $("a:contains('Chương 1'), a:contains('Đọc từ đầu')").attr("href") || "";
    firstChapterUrl = abs(pageUrl, direct);
  }

  let extSeriesId: string | undefined;
  try {
    const u = new URL(pageUrl);
    extSeriesId = u.pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    /* noop */
  }

  const hasMoreChapters =
    $(".chapter-pagination a, .pagination a, [data-type='pager'] a")
      .length > 0;

  return {
    extSeriesId,
    canonicalUrl: pageUrl,
    title,
    description,
    coverImage: cover,
    status,
    chapterUrls,
    firstChapterUrl: firstChapterUrl ?? null,
    hasMoreChapters,
  };
}

function parseChapter(html: string, pageUrl: string): ChapterParseResult {
  const $ = cheerio.load(html);
  const content =
    $("#chapter-content, .chapter-content, [data-type='chapter-content']")
      .first()
      .html()
      ?.trim() || undefined;

  const title =
    $(".chapter-title, h1, h2.title").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    undefined;

  const nextHref =
    $("a[rel='next']").attr("href") ||
    $("a:contains('Chương sau'), a:contains('Tiếp')").attr("href") ||
    $(".chapter-nav a.next").attr("href") ||
    null;

  let index: number | undefined;
  try {
    const { pathname } = new URL(pageUrl);
    const m = pathname.match(/\/chuong-(\d+)\/?$/i);
    if (m) index = parseInt(m[1], 10);
  } catch {
    /* noop */
  }

  return {
    index,
    title,
    contentHtml: content,
    nextUrl: abs(pageUrl, nextHref || undefined) ?? null,
  };
}

export const meTruyenCvAdapter: CrawlAdapter = {
  extractCategory(html, pageUrl) {
    return { seriesUrls: extractCategory(html, pageUrl) };
  },
  parseSeries,
  parseChapter,
};
