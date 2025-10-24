import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { CrawlerPersistService } from "@/modules/crawl/crawler-persist.service";

@Processor("crawl")
export class CrawlWorker extends WorkerHost {
  constructor(private readonly persist: CrawlerPersistService) {
    super();
  }

  async process(job: any) {
    if (job.name === "novel") {
      return this.persist.upsertNovel(job.data);
    }
    if (job.name === "chapter") {
      return this.persist.upsertChapter(job.data);
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: any, err: any) {
    console.error(
      `[crawl][failed] ${job?.name} ${job?.id}:`,
      err?.message || err
    );
  }
}
