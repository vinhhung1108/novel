import { Injectable, Logger } from "@nestjs/common";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class CrawlHttpService {
  private readonly logger = new Logger(CrawlHttpService.name);
  private readonly lastRequestAt = new Map<string, number>();

  /** Minimum delay between two requests to the same host (ms) */
  private readonly minIntervalMs = 750;

  private async waitTurn(url: string) {
    let host = "default";
    try {
      host = new URL(url).host || "default";
    } catch {
      /* ignore */
    }

    const now = Date.now();
    const last = this.lastRequestAt.get(host) ?? 0;
    const elapsed = now - last;
    if (elapsed < this.minIntervalMs) {
      const wait = this.minIntervalMs - elapsed;
      await sleep(wait);
    }
    this.lastRequestAt.set(host, Date.now());
  }

  async fetchHtml(url: string, timeoutMs = 20000): Promise<string> {
    await this.waitTurn(url);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      this.logger.debug(`Fetch ${url}`);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36",
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `HTTP ${res.status} ${res.statusText} when fetching ${url} :: ${text.slice(0, 120)}`
        );
      }
      return await res.text();
    } finally {
      clearTimeout(t);
    }
  }
}
