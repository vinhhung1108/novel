import { Controller, Post, Body, BadRequestException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import * as cheerio from "cheerio";
import {
  CrawlerPersistService,
  NovelDTO,
  ChapterDTO,
} from "./crawler-persist.service";

// helper: fetch với timeout đơn giản
async function getHtml(url: string, timeoutMs = 15000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// helper: chuẩn hoá URL tuyệt đối
function toAbs(base: string, href?: string | null) {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

@Controller("crawl")
export class CrawlController {
  constructor(
    @InjectQueue("crawl") private readonly crawlQ: Queue,
    private readonly persist: CrawlerPersistService
  ) {}

  /** Seed theo URL thể loại: lấy link truyện và enqueue job parse-series-page */
  @Post("seed-category")
  async seedCategory(
    @Body() body: { source_id: string; url: string; limit?: number }
  ) {
    const { source_id, url, limit = 50 } = body || {};
    if (!source_id || !url)
      throw new BadRequestException("source_id & url required");

    const html = await getHtml(url, 15000);
    const $ = cheerio.load(html);

    // Thu link truyện (selector “an toàn”, bạn có thể tinh chỉnh theo site)
    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href")?.trim();
      const abs = toAbs(url, href || "");
      if (abs && /^https?:\/\//i.test(abs) && !links.includes(abs)) {
        // lọc sơ bộ: đường dẫn có “truyen”/“novel”
        if (/(truyen|novel|story)/i.test(new URL(abs).pathname)) {
          links.push(abs);
        }
      }
    });

    const pick = links.slice(0, limit);

    for (const link of pick) {
      await this.crawlQ.add(
        "parse-series-page",
        { source_id, url: link },
        { attempts: 3, backoff: { type: "exponential", delay: 2000 } }
      );
    }

    return { ok: true, enqueued: pick.length };
  }

  /** Dùng để test pipeline persist (bỏ qua parser) */
  @Post("persist/novel")
  async persistNovel(@Body() dto: NovelDTO) {
    const novel = await this.persist.upsertNovel(dto);
    return { ok: true, novel_id: novel.id };
  }

  @Post("persist/chapter")
  async persistChapter(@Body() dto: ChapterDTO) {
    const ch = await this.persist.upsertChapter(dto);
    return { ok: true, chapter_id: ch.id, index_no: ch.index_no };
  }
}
