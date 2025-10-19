import { Injectable } from "@nestjs/common";
import { MeiliSearch } from "meilisearch";

@Injectable()
export class SearchService {
  private client = new MeiliSearch({
    host: process.env.MEILI_HOST || "http://localhost:7700",
    apiKey: process.env.MEILI_API_KEY || undefined,
  });
  novels = this.client.index("novels");
  chapters = this.client.index("chapters");
}
