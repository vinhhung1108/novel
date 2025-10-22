declare module "@bull-board/express" {
  import type { Router } from "express";
  class ExpressAdapter {
    constructor();
    setBasePath(path: string): void;
    getRouter(): Router;
  }
  export { ExpressAdapter };
}

declare module "@bull-board/api" {
  import type { ExpressAdapter } from "@bull-board/express";
  import type { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
  interface BoardOptions {
    queues: BullMQAdapter[];
    serverAdapter: ExpressAdapter;
  }
  export function createBullBoard(options: BoardOptions): unknown;
}

declare module "@bull-board/api/bullMQAdapter" {
  import type { Queue } from "bullmq";
  class BullMQAdapter {
    constructor(queue: Queue, options?: Record<string, unknown>);
  }
  export { BullMQAdapter };
}
