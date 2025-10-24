import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import * as cheerio from "cheerio";
import { CrawlerPersistService } from "@/modules/crawl/crawler-persist.service";

const toAbs = (base: string, href?: string | null) => {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
};

@Processor("crawl")
export class ChapterProcessor extends WorkerHost {
  constructor(
    private readonly persist: CrawlerPersistService,
    @InjectQueue("crawl") private readonly crawlQ: Queue
  ) {
    super();
  }

  async process(job: Job<any>) {
    if (job.name !== "parse-chapter-page") return;

    const { source_id, novel_id, url } = job.data as {
      source_id: string;
      novel_id: string;
      url: string;
    };

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $(".chapter-title, h1, h2.title").first().text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      "Chương";

    const m =
      title.match(/(\d+)\b/) ||
      new URL(url).pathname.replace(/^\/+|\/+$/g, "").match(/(\d+)\b/);
    const index_no = m ? parseInt(m[1], 10) : NaN;
    if (!Number.isFinite(index_no)) throw new Error("cannot detect index_no");

    const content_html =
      $("#chapter-c, .chapter-c, .chapter-content, .content")
        .first()
        .html()
        ?.trim() || "";

    const ext_chapter_id = new URL(url).pathname.replace(/^\/+|\/+$/g, "");

    await this.persist.upsertChapter({
      source_id,
      ext_chapter_id,
      novel_id,
      index_no,
      title,
      url,
      content_html,
    });

    const nextHref =
      $(
        "a:contains('Chương sau'), a:contains('Chương tiếp'), a[rel='next'], .next-chap[href]"
      ).attr("href") || $(".chapter-nav a[rel='next']").attr("href");
    const nextUrl = toAbs(url, nextHref);

    if (nextUrl) {
      await this.crawlQ.add(
        "parse-chapter-page",
        { source_id, novel_id, url: nextUrl },
        { attempts: 3, backoff: { type: "exponential", delay: 2000 } }
      );
    }

    return { ok: true, novel_id, index_no, next_enqueued: !!nextUrl };
  }
}
