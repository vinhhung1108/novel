import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import * as cheerio from "cheerio";
import {
  CrawlerPersistService,
  NovelDTO,
} from "@/modules/crawl/crawler-persist.service";

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
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
};

@Processor("crawl")
export class SeriesProcessor extends WorkerHost {
  constructor(
    private readonly persist: CrawlerPersistService,
    @InjectQueue("crawl") private readonly crawlQ: Queue
  ) {
    super();
  }

  // Nhận MỌI job của queue "crawl" -> lọc theo job.name
  async process(job: Job<any>) {
    if (job.name !== "parse-series-page") return;

    const { source_id, url } = job.data as { source_id: string; url: string };

    // dùng fetch (Node 18+) thay vì got
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $("h1, h2.book-title, .title").first().text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      "";
    if (!title) throw new Error("cannot parse series title");

    const ext_series_id = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    const slug = slugify(title);

    const desc =
      $(".desc, .book-desc, .mota, .description").first().text().trim() ||
      $('meta[name="description"]').attr("content") ||
      null;

    const bodyText = $("body").text() || "";
    const status = /\b(hoàn|full|completed)\b/i.test(bodyText)
      ? "completed"
      : "ongoing";

    const dto: NovelDTO = {
      source_id,
      ext_series_id,
      url,
      title,
      slug,
      description: desc,
      cover_image_key: null,
      status,
    };

    const novel = await this.persist.upsertNovel(dto);

    const firstHref =
      $(
        "a:contains('Chương 1'), a:contains('ĐỌC TỪ ĐẦU'), a:contains('Đọc từ đầu')"
      )
        .first()
        .attr("href") ||
      $(".list-chapter a[href], .chapter-list a[href], a.chapter[href]")
        .first()
        .attr("href") ||
      $("a[href*='chuong-1']").first().attr("href");

    const firstUrl = toAbs(url, firstHref);
    if (firstUrl) {
      await this.crawlQ.add(
        "parse-chapter-page",
        { source_id, novel_id: novel.id, url: firstUrl },
        { attempts: 3, backoff: { type: "exponential", delay: 2000 } }
      );
    }

    return { ok: true, novel_id: novel.id, first_chapter_enqueued: !!firstUrl };
  }
}
