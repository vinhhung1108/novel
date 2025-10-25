import * as cheerio from "cheerio";

/** Fallback generic: guess series links from category page */
export function genericExtractSeriesLinks(
  html: string,
  baseUrl: string
): string[] {
  const $ = cheerio.load(html);
  const set = new Set<string>();
  const abs = (href?: string | null) => {
    if (!href) return null;
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  };

  $("a[href]").each((_, el) => {
    const u = abs($(el).attr("href") || "");
    if (!u) return;
    try {
      const { pathname } = new URL(u);
      const isSeriesPath =
        /^\/[^/]+\/?$/i.test(pathname) &&
        !/\/(the-loai|chuong-\d+)\/?$/i.test(pathname);
      if (isSeriesPath) set.add(u);
    } catch {
      /* noop */
    }
  });

  return Array.from(set);
}
