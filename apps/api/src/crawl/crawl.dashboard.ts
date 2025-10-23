import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Queue } from "bullmq";

export function setupBullBoard(app: any) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/bull");
  const connection = {
    host: process.env.REDIS_HOST ?? "localhost",
    port: +(process.env.REDIS_PORT ?? 6379),
  };

  const seriesQueue = new Queue("crawl-series", { connection });
  const chapterQueue = new Queue("crawl-chapter", { connection });

  createBullBoard({
    queues: [new BullMQAdapter(seriesQueue), new BullMQAdapter(chapterQueue)],
    serverAdapter,
  });
  app.use("/bull", serverAdapter.getRouter());
  // eslint-disable-next-line no-console
  console.log("BullMQ dashboard available at /bull");
}
