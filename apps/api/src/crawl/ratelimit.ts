// apps/api/src/crawl/ratelimit.ts
export class RateGate {
  private times: number[] = [];
  constructor(
    private max: number,
    private durationMs: number
  ) {}

  private prune(now: number) {
    const from = now - this.durationMs;
    this.times = this.times.filter((t) => t >= from);
  }

  async wait(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.prune(now);
      if (this.times.length < this.max) {
        this.times.push(now);
        return;
      }
      const oldest = this.times[0];
      const waitMs = Math.max(0, this.durationMs - (now - oldest));
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}
