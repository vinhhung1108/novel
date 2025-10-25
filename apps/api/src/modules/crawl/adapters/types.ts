export type CategoryExtractResult = {
  seriesUrls: string[];
};

export type SeriesParseResult = {
  /** External identifier (slug) derived from URL or metadata */
  extSeriesId?: string;
  /** Canonical URL for the series (if adapter normalises) */
  canonicalUrl?: string;
  title?: string;
  description?: string | null;
  coverImage?: string | null;
  status?: "ongoing" | "completed" | "hiatus";
  altTitles?: string[];
  firstChapterUrl?: string | null;
  /** Optional list of chapter URLs (absolute) */
  chapterUrls?: string[];
  /** Adapter can flag that there are more chapters beyond provided list */
  hasMoreChapters?: boolean;
};

export type ChapterParseResult = {
  index?: number;
  title?: string;
  contentHtml?: string;
  nextUrl?: string | null;
};

export interface CrawlAdapter {
  /** Extract series URLs from a category/listing page */
  extractCategory(html: string, pageUrl: string): CategoryExtractResult;
  /** Parse a series page for metadata & optional chapter list */
  parseSeries(html: string, pageUrl: string): SeriesParseResult;
  /** Optional parser for chapter pages */
  parseChapter?(html: string, pageUrl: string): ChapterParseResult | null;
}

export interface AdapterResolveContext {
  sourceId: string;
  sourceName?: string | null;
  baseUrl?: string | null;
  /** raw identifier submitted by user/queue */
  identifier?: string;
}
