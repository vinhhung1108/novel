import { apiGet, apiPost, AuthHeaderGetter } from "./apiClient";

export type CrawlSource = {
  id: string;
  name: string;
  baseUrl: string;
  createdAt: string;
};

export type JobStatusKey =
  | "waiting"
  | "active"
  | "delayed"
  | "failed"
  | "completed";

export type CrawlJobItem = {
  id: string;
  name: string;
  status: JobStatusKey;
  attemptsMade: number;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  progress: number | null;
  failedReason: string | null;
  data: unknown;
  returnValue: unknown;
  stacktrace: string[];
};

export type CrawlQueueJobs = Record<JobStatusKey, CrawlJobItem[]>;

export type CrawlJobStatusResponse = {
  series: CrawlQueueJobs;
  chapter: CrawlQueueJobs;
  limit: number;
};

export async function fetchSources(
  getAuthHeader: AuthHeaderGetter,
  limit = 100
) {
  const search = new URLSearchParams({ limit: String(limit) });
  return apiGet<{ items: CrawlSource[]; limit: number }>(
    `/crawl/sources?${search.toString()}`,
    {
      headers: {
        ...getAuthHeader(),
      },
    }
  );
}

export function createSource(
  payload: { name: string; baseUrl: string },
  getAuthHeader: AuthHeaderGetter
) {
  return apiPost<{ id: string }>(`/crawl/sources`, payload, getAuthHeader);
}

export function enqueueSeries(
  payload: { sourceId: string; extSeriesId: string; url: string },
  getAuthHeader: AuthHeaderGetter
) {
  return apiPost<{ ok: boolean; jobId: string }>(
    `/crawl/series`,
    payload,
    getAuthHeader
  );
}

export function enqueueChapter(
  payload: {
    sourceId: string;
    seriesId: string;
    extChapterId: string;
    url: string;
    indexNo?: number;
  },
  getAuthHeader: AuthHeaderGetter
) {
  return apiPost<{ ok: boolean; jobId: string }>(
    `/crawl/chapters`,
    payload,
    getAuthHeader
  );
}

export function fetchJobStatus(
  getAuthHeader: AuthHeaderGetter,
  limit = 20
) {
  const search = new URLSearchParams({ limit: String(limit) });
  return apiGet<CrawlJobStatusResponse>(`/crawl/jobs?${search.toString()}`, {
    headers: {
      ...getAuthHeader(),
    },
  });
}
