"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { apiUrl } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type Source = {
  id: string;
  name: string;
  base_url: string;
};

type QueueStats = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
};

type QueueStatsResponse = QueueStats & {
  breakdown?: {
    series: QueueStats;
    chapters: QueueStats;
  };
};

type QueueJobDetail = {
  id: string;
  name: string;
  attemptsMade: number;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  progress: number | null;
  failedReason: string | null;
  stacktrace: string[];
  data: unknown;
  returnValue: unknown;
  queue?: string;
};

type QueueJobBuckets = {
  waiting: QueueJobDetail[];
  active: QueueJobDetail[];
  delayed: QueueJobDetail[];
  failed: QueueJobDetail[];
  completed: QueueJobDetail[];
};

type QueueJobsResponse = QueueJobBuckets & { limit: number };

const JOB_LIMIT = 10;
const RUN_LIMIT = 10;

const JOB_SECTIONS: Array<{
  key: Exclude<keyof QueueJobBuckets, "failed">;
  label: string;
  empty: string;
}> = [
  {
    key: "active",
    label: "Job đang chạy",
    empty: "Không có job đang chạy.",
  },
  {
    key: "waiting",
    label: "Job đang chờ",
    empty: "Không có job đang chờ xử lý.",
  },
  {
    key: "delayed",
    label: "Job delay",
    empty: "Không có job delay.",
  },
  {
    key: "completed",
    label: "Hoàn tất gần đây",
    empty: "Chưa có job hoàn tất trong danh sách giới hạn.",
  },
];

function formatTime(value?: number | string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function extractJobUrl(data: unknown): string | null {
  if (data && typeof data === "object") {
    if ("url" in data && typeof (data as any).url === "string") {
      return (data as any).url;
    }
    if ("link" in data && typeof (data as any).link === "string") {
      return (data as any).link;
    }
  }
  return null;
}

export default function CrawlPage() {
  const router = useRouter();
  const { token, getAuthHeader } = useAuth();

  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [sourceOverride, setSourceOverride] = useState("");

  const [categoryUrl, setCategoryUrl] = useState("");
  const [categoryLimit, setCategoryLimit] = useState("10");
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [seriesUrl, setSeriesUrl] = useState("");
  const [seriesSubmitting, setSeriesSubmitting] = useState(false);
  const [seriesMessage, setSeriesMessage] = useState<string | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  const [stats, setStats] = useState<QueueStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<QueueJobsResponse | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [failedError, setFailedError] = useState<string | null>(null);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [clearingFailed, setClearingFailed] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);

  useEffect(() => {
    if (token === null) {
      router.replace("/login");
    }
  }, [token, router]);

  const effectiveSourceId = useMemo(() => {
    return sourceOverride.trim() || selectedSourceId;
  }, [sourceOverride, selectedSourceId]);

  const selectedSource = useMemo(
    () => sources.find((s) => s.id === selectedSourceId) ?? null,
    [selectedSourceId, sources]
  );

  const headersWithAuth = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...getAuthHeader(),
    }),
    [getAuthHeader]
  );

  const loadSources = useCallback(async () => {
    if (!token) return;
    setSourcesLoading(true);
    setSourcesError(null);
    try {
      const res = await fetch(apiUrl("/sources"), {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as Source[];
      setSources(data ?? []);
      if (!selectedSourceId && data?.length) {
        setSelectedSourceId(data[0].id);
      }
    } catch (err: any) {
      setSourcesError(err?.message ?? "Không tải được danh sách nguồn");
      setSources([]);
    } finally {
      setSourcesLoading(false);
    }
  }, [getAuthHeader, selectedSourceId, token]);

  const loadDiagnostics = useCallback(async () => {
    if (!token) return;
    setStatsLoading(true);
    setStatsError(null);
    setJobsLoading(true);
    setJobsError(null);
    setFailedError(null);
    setFailedMessage(null);
    setRunsLoading(true);
    setRunsError(null);
    try {
      const statsRes = await fetch(apiUrl("/crawl/queue-stats"), {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      });
      if (!statsRes.ok) throw new Error(`HTTP ${statsRes.status}`);
      const statsJson = (await statsRes.json()) as QueueStatsResponse;
      setStats(statsJson);
    } catch (err: any) {
      setStats(null);
      setStatsError(err?.message ?? "Không lấy được thống kê queue");
    } finally {
      setStatsLoading(false);
    }

    try {
      const jobsRes = await fetch(
        apiUrl(`/crawl/jobs?limit=${JOB_LIMIT}`),
        {
          headers: { ...getAuthHeader() },
          cache: "no-store",
        }
      );
      if (!jobsRes.ok) throw new Error(`HTTP ${jobsRes.status}`);
      const jobsJson = (await jobsRes.json()) as QueueJobsResponse;
      setJobs(jobsJson);
    } catch (err: any) {
      setJobs(null);
      setJobsError(err?.message ?? "Không lấy được danh sách job");
    } finally {
      setJobsLoading(false);
    }

    try {
      const runsRes = await fetch(apiUrl(`/crawl/runs?limit=${RUN_LIMIT}`), {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      });
      if (!runsRes.ok) throw new Error(`HTTP ${runsRes.status}`);
      const runsJson = (await runsRes.json()) as any[];
      setRuns(Array.isArray(runsJson) ? runsJson : []);
    } catch (err: any) {
      setRuns([]);
      setRunsError(err?.message ?? "Không tải được lịch sử crawl");
    } finally {
      setRunsLoading(false);
    }
  }, [getAuthHeader, token]);

  useEffect(() => {
    if (!token) return;
    loadSources();
    loadDiagnostics();
  }, [token, loadSources, loadDiagnostics]);

  async function handleSeedCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCategoryMessage(null);
    setCategoryError(null);

    const payload = {
      source_id: effectiveSourceId,
      url: categoryUrl.trim(),
      limit: Number(categoryLimit) || 10,
    };

    if (!payload.source_id) {
      setCategoryError("Vui lòng chọn nguồn hoặc nhập source_id");
      return;
    }
    if (!payload.url) {
      setCategoryError("URL thể loại không được để trống");
      return;
    }

    setCategorySubmitting(true);
    try {
      const res = await fetch(apiUrl("/crawl/seed-category"), {
        method: "POST",
        headers: headersWithAuth(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setCategoryMessage(
        `Run ${json?.run_id ? json.run_id.slice(0, 8) : "?"}: Đã enqueue ${
          json?.enqueued ?? 0
        } (tổng tìm thấy ${json?.found ?? 0})`
      );
      await loadDiagnostics();
    } catch (err: any) {
      setCategoryError(err?.message ?? "Không seed được queue");
    } finally {
      setCategorySubmitting(false);
    }
  }

  async function handleSeedSeries(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSeriesMessage(null);
    setSeriesError(null);

    const payload = {
      source_id: effectiveSourceId,
      url: seriesUrl.trim(),
    };

    if (!payload.source_id) {
      setSeriesError("Vui lòng chọn nguồn hoặc nhập source_id");
      return;
    }
    if (!payload.url) {
      setSeriesError("URL truyện không được để trống");
      return;
    }

    setSeriesSubmitting(true);
    try {
      const res = await fetch(apiUrl("/crawl/seed-series"), {
        method: "POST",
        headers: headersWithAuth(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setSeriesMessage(
        json?.ok
          ? `Run ${json?.run_id ? json.run_id.slice(0, 8) : "?"}: Đã enqueue job parse-series-page`
          : "Đã gửi yêu cầu"
      );
      await loadDiagnostics();
    } catch (err: any) {
      setSeriesError(err?.message ?? "Không enqueue được job");
    } finally {
      setSeriesSubmitting(false);
    }
  }

  async function handleClearFailed() {
    if (!token) return;
    setClearingFailed(true);
    setFailedError(null);
    setFailedMessage(null);
    try {
      const res = await fetch(apiUrl("/crawl/failed"), {
        method: "DELETE",
        headers: headersWithAuth(),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { cleared?: number };
      await loadDiagnostics();
      setFailedMessage(`Đã xoá ${json?.cleared ?? 0} job lỗi`);
    } catch (err: any) {
      setFailedError(err?.message ?? "Không xoá được job lỗi");
    } finally {
      setClearingFailed(false);
    }
  }

  async function handleQueueControl(
    action: "pause" | "resume",
    queue: "series" | "chapters" | "all"
  ) {
    if (!token) return;
    try {
      const res = await fetch(apiUrl(`/crawl/${action}`), {
        method: "POST",
        headers: headersWithAuth(),
        body: JSON.stringify({ queue }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      await loadDiagnostics();
    } catch (err: any) {
      setJobsError(err?.message ?? `Không thể ${action} queue`);
    }
  }

  const failedJobs = jobs?.failed ?? [];
  const jobLimit = jobs?.limit ?? JOB_LIMIT;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Crawler</h1>
        <p className="text-sm text-zinc-600">
          Seed nhanh crawl queue, xem thống kê và job lỗi để debug.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nguồn dữ liệu</CardTitle>
          <CardDescription>
            Chọn nguồn đã có trong hệ thống hoặc nhập thủ công một identifier
            (ví dụ slug cũ) nếu cần.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="source-select">Chọn source</Label>
              <Select
                value={selectedSourceId}
                onValueChangeAction={(val) => setSelectedSourceId(val)}
              >
                <SelectTrigger id="source-select">
                  <SelectValue
                    placeholder={
                      sourcesLoading
                        ? "Đang tải..."
                        : "Chọn một nguồn trong danh sách"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{source.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {source.base_url}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sourcesError && (
                <p className="text-sm text-red-600">{sourcesError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-override">source_id thủ công (optional)</Label>
              <Input
                id="source-override"
                placeholder="Ví dụ: truyenfull"
                value={sourceOverride}
                onChange={(e) => setSourceOverride(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Nếu để trống, hệ thống sẽ dùng source đã chọn phía trái.
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Chi tiết job theo trạng thái
            </h3>
            {jobsError && (
              <p className="text-sm text-red-600">{jobsError}</p>
            )}
            {!jobsError &&
              JOB_SECTIONS.map(({ key, label, empty }) => {
                const list = jobs?.[key] ?? [];
                return (
                  <div key={key} className="space-y-2">
                    <div className="text-sm font-medium text-zinc-700">
                      {label} ({list.length})
                    </div>
                    {jobsLoading ? (
                      <p className="text-xs text-zinc-500">Đang tải...</p>
                    ) : list.length === 0 ? (
                      <p className="text-xs text-zinc-500">{empty}</p>
                    ) : (
                      <div className="space-y-3">
                        {list.map((job) => {
                          const jobUrl = extractJobUrl(job.data);
                          const runId =
                            job.data && typeof job.data === "object" && "run_id" in job.data
                              ? (job.data as Record<string, any>).run_id
                              : null;
                          return (
                            <div
                              key={job.id}
                              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold">
                                  #{job.id} · {job.name}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700">
                                    attempts: {job.attemptsMade}
                                  </span>
                                  {job.queue && (
                                    <span className="rounded bg-zinc-200/70 px-2 py-0.5 text-xs uppercase text-zinc-700">
                                      {job.queue}
                                    </span>
                                  )}
                                  {runId && (
                                    <span className="rounded bg-zinc-200/60 px-2 py-0.5 text-xs text-zinc-700">
                                      run: {String(runId).slice(0, 8)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {job.progress !== null && (
                                <div className="mt-1 text-xs text-zinc-600">
                                  Tiến độ: {job.progress}%
                                </div>
                              )}
                              {jobUrl && (
                                <p className="mt-2 break-all text-xs text-zinc-600">
                                  URL: {jobUrl}
                                </p>
                              )}
                              <div className="mt-2 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
                                <span>Enqueue: {formatTime(job.timestamp)}</span>
                                <span>Bắt đầu: {formatTime(job.processedOn)}</span>
                                <span>Hoàn tất: {formatTime(job.finishedOn)}</span>
                              </div>
                              {job.failedReason && (
                                <p className="mt-2 text-xs text-red-600">
                                  {job.failedReason}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Lịch sử crawl (tối đa {RUN_LIMIT})
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => loadDiagnostics()}
              >
                Làm mới
              </Button>
            </div>
            {runsLoading && (
              <p className="text-xs text-zinc-500">Đang tải...</p>
            )}
            {runsError && (
              <p className="text-sm text-red-600">{runsError}</p>
            )}
            {!runsLoading && !runsError && runs.length === 0 && (
              <p className="text-sm text-zinc-500">Chưa có lịch sử crawl.</p>
            )}
            <div className="space-y-3">
              {runs.map((run) => {
                const runId = run?.id as string | undefined;
                const status = (run?.status as string | undefined) ?? "running";
                const seriesStats = `${run?.completed_series ?? 0}/${
                  run?.queued_series ?? 0
                } series`;
                const chapterStats = `${run?.completed_chapters ?? 0}/${
                  run?.queued_chapters ?? 0
                } chương`;
                let contextData: unknown = run?.context;
                if (typeof contextData === "string") {
                  try {
                    contextData = JSON.parse(contextData);
                  } catch {
                    /* keep string */
                  }
                }
                return (
                  <div
                    key={runId ?? Math.random().toString(36)}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900">
                          {run?.run_type ?? "run"} · {runId?.slice(0, 8) ?? "--"}
                        </span>
                        <span className="text-xs text-zinc-500">
                          nguồn: {run?.source_name ?? run?.source_identifier}
                        </span>
                      </div>
                      <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium uppercase text-zinc-700">
                        {status}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-zinc-600 sm:grid-cols-3">
                      <span>Enqueue: {formatTime(run?.started_at)}</span>
                      <span>Kết thúc: {formatTime(run?.finished_at)}</span>
                      <span>Fail: {run?.failed_jobs ?? 0}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-600">
                      <span>{seriesStats}</span>
                      <span>{chapterStats}</span>
                    </div>
                    {contextData && (
                      <pre className="mt-2 overflow-x-auto rounded bg-white/60 p-2 text-xs text-zinc-500">
                        {JSON.stringify(contextData, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {selectedSource && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="font-medium text-zinc-900">
                Đang chọn: {selectedSource.name}
              </div>
              <div>ID: {selectedSource.id}</div>
              <div>Base URL: {selectedSource.base_url}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seed queue</CardTitle>
          <CardDescription>
            Dùng để enqueue job crawl từ trang thể loại hoặc 1 truyện cụ thể.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            onSubmit={handleSeedCategory}
            className="space-y-4 rounded-lg border border-zinc-200 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-900">
                Seed từ trang thể loại
              </h2>
              <span className="text-xs uppercase tracking-wide text-zinc-500">
                parse-series-page
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="category-url">URL thể loại</Label>
                <Input
                  id="category-url"
                  placeholder="https://..."
                  value={categoryUrl}
                  onChange={(e) => setCategoryUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-limit">Giới hạn enqueue</Label>
                <Input
                  id="category-limit"
                  type="number"
                  min={1}
                  max={50}
                  value={categoryLimit}
                  onChange={(e) => setCategoryLimit(e.target.value)}
                />
              </div>
            </div>

            {categoryError && (
              <p className="text-sm text-red-600">{categoryError}</p>
            )}
            {categoryMessage && (
              <p className="text-sm text-emerald-600">{categoryMessage}</p>
            )}

            <Button type="submit" disabled={categorySubmitting}>
              {categorySubmitting ? "Đang enqueue..." : "Seed category"}
            </Button>
          </form>

          <Separator />

          <form
            onSubmit={handleSeedSeries}
            className="space-y-4 rounded-lg border border-zinc-200 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-900">
                Seed 1 truyện
              </h2>
              <span className="text-xs uppercase tracking-wide text-zinc-500">
                parse-series-page
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="series-url">URL truyện</Label>
              <Input
                id="series-url"
                placeholder="https://..."
                value={seriesUrl}
                onChange={(e) => setSeriesUrl(e.target.value)}
              />
            </div>

            {seriesError && (
              <p className="text-sm text-red-600">{seriesError}</p>
            )}
            {seriesMessage && (
              <p className="text-sm text-emerald-600">{seriesMessage}</p>
            )}

            <Button type="submit" disabled={seriesSubmitting}>
              {seriesSubmitting ? "Đang enqueue..." : "Seed series"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Trạng thái queue</CardTitle>
            <CardDescription>
              Theo dõi nhanh số job đang chờ, đang chạy và lỗi gần đây.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadDiagnostics()}
              disabled={statsLoading || jobsLoading}
            >
              {statsLoading || jobsLoading ? "Đang tải..." : "Làm mới"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleQueueControl("pause", "all")}
            >
              Tạm dừng
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleQueueControl("resume", "all")}
            >
              Tiếp tục
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-5">
            {(["waiting", "active", "delayed", "failed", "completed"] as Array<
              keyof QueueStats
            >).map((key) => {
              const value = stats ? stats[key] : undefined;
              return (
                <div
                  key={key}
                  className="rounded-lg border border-zinc-200 p-3 text-center"
                >
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {key}
                  </div>
                  <div className="text-2xl font-semibold text-zinc-900">
                    {value ?? "-"}
                  </div>
                </div>
              );
            })}
          </div>
          {stats?.breakdown && (
            <div className="grid gap-2 rounded-lg border border-zinc-200 p-3 text-xs text-zinc-600 sm:grid-cols-2">
              <div>
                <div className="font-semibold text-zinc-700">Series queue</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(["waiting", "active", "delayed", "failed", "completed"] as Array<
                    keyof QueueStats
                  >).map((key) => (
                    <span key={key}>
                      {key}: {stats.breakdown.series[key]}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-semibold text-zinc-700">Chapters queue</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(["waiting", "active", "delayed", "failed", "completed"] as Array<
                    keyof QueueStats
                  >).map((key) => (
                    <span key={key}>
                      {key}: {stats.breakdown.chapters[key]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {statsError && (
            <p className="text-sm text-red-600">{statsError}</p>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Job lỗi gần đây (tối đa {jobLimit})
              </h3>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleClearFailed}
                disabled={clearingFailed || jobsLoading}
              >
                {clearingFailed ? "Đang xoá..." : "Xoá job lỗi"}
              </Button>
            </div>
            {jobsError && (
              <p className="text-sm text-red-600">{jobsError}</p>
            )}
            {failedError && (
              <p className="text-sm text-red-600">{failedError}</p>
            )}
            {failedMessage && (
              <p className="text-sm text-emerald-600">{failedMessage}</p>
            )}
            {!jobsLoading && !jobsError && failedJobs.length === 0 && (
              <p className="text-sm text-zinc-500">Không có job lỗi.</p>
            )}
            <div className="space-y-3">
              {!jobsError &&
                failedJobs.map((job) => {
                  const stack = job.stacktrace?.[0] ?? null;
                  const jobUrl = extractJobUrl(job.data);
                  const runId =
                    job.data && typeof job.data === "object" && "run_id" in job.data
                      ? (job.data as Record<string, any>).run_id
                      : null;
                  return (
                    <div
                      key={job.id}
                      className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          #{job.id} · {job.name}
                        </span>
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs">
                          attempts: {job.attemptsMade}
                        </span>
                        {job.queue && (
                          <span className="rounded bg-red-100/70 px-2 py-0.5 text-xs uppercase">
                            {job.queue}
                          </span>
                        )}
                        {runId && (
                          <span className="rounded bg-red-100/60 px-2 py-0.5 text-xs">
                            run: {String(runId).slice(0, 8)}
                          </span>
                        )}
                      </div>
                      {job.failedReason && (
                        <p className="mt-2 font-medium">{job.failedReason}</p>
                      )}
                      {jobUrl && (
                        <p className="mt-2 break-all text-xs text-red-800">
                          URL: {jobUrl}
                        </p>
                      )}
                      {stack && (
                        <pre className="mt-2 overflow-x-auto rounded bg-red-100 p-2 text-xs leading-relaxed text-red-800">
                          {stack}
                        </pre>
                      )}
                      {job.data && (
                        <pre className="mt-2 overflow-x-auto rounded bg-white/80 p-2 text-xs text-red-800">
                          {JSON.stringify(job.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
