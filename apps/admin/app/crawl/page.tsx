"use client";

import * as React from "react";

/* UI */
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
  TableFooter,
} from "@/components/ui/table";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* -------------------------------------------------------------
 * Types
 * ------------------------------------------------------------- */

type Source = {
  id: string;
  name: string;
  domain?: string | null;
  created_at?: string;
};

type Health = {
  ok: boolean;
  redis?: boolean;
  queues?: {
    series: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    chapter: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  };
};

type Job = {
  id: string;
  name: string;
  queue: "crawl-series" | "crawl-chapter" | string;
  state: "waiting" | "active" | "completed" | "failed" | "delayed" | "paused";
  progress?: number;
  attemptsMade?: number;
  failedReason?: string | null;
  timestamp?: number;
};

type EnqueuePayload = {
  source_id: string;
  url: string;
  ext_series_id: string; // external id (slug/path)
};

type EnqueueResponse = {
  ok: boolean;
  enqueued?: number;
  seriesId?: string;
  message?: string;
};

/* -------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------- */

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL as string | undefined) ??
  "http://localhost:4000";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} - ${text}`);
  }
  return (await res.json()) as T;
}

const fmt = {
  num: (n: number | undefined) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "-",
  dt: (ts?: number | string) => {
    if (!ts) return "-";
    const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  },
};

/* -------------------------------------------------------------
 * Page
 * ------------------------------------------------------------- */

export default function CrawlPage() {
  /** data */
  const [loading, setLoading] = React.useState(false);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [health, setHealth] = React.useState<Health | null>(null);
  const [jobs, setJobs] = React.useState<Job[]>([]);

  /** form */
  const [sourceId, setSourceId] = React.useState<string>("");
  const [url, setUrl] = React.useState<string>("");
  const [extSeriesId, setExtSeriesId] = React.useState<string>("");

  const [enqueueing, setEnqueueing] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [healthResp, srcResp, jobsResp] = await Promise.all([
        json<Health>("/v1/crawl/health"),
        json<{ items: Source[] }>("/v1/sources"),
        json<{ items: Job[] }>("/v1/crawl/jobs"),
      ]);
      setHealth(healthResp);
      setSources(srcResp?.items ?? []);
      setJobs(jobsResp?.items ?? []);
      if (!sourceId && srcResp?.items?.length) {
        setSourceId(srcResp.items[0].id);
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  React.useEffect(() => {
    // initial
    loadAll();
  }, [loadAll]);

  async function handleEnqueue(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!sourceId || !url || !extSeriesId) {
      setErr("Vui lòng chọn Source, nhập URL và External Series ID.");
      return;
    }
    try {
      setEnqueueing(true);
      const payload: EnqueuePayload = {
        source_id: sourceId,
        url,
        ext_series_id: extSeriesId,
      };
      const resp = await json<EnqueueResponse>("/v1/crawl/enqueue-series", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMsg(
        resp.ok
          ? `Đã enqueue series thành công${resp.enqueued ? ` (${resp.enqueued} jobs)` : ""}.`
          : (resp.message ?? "Enqueue không thành công.")
      );
      // reload jobs nhanh
      const jobsResp = await json<{ items: Job[] }>("/v1/crawl/jobs");
      setJobs(jobsResp?.items ?? []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setEnqueueing(false);
    }
  }

  function badgeForState(state: Job["state"]) {
    const map: Record<string, string> = {
      waiting: "bg-amber-50 text-amber-700 border border-amber-200",
      delayed: "bg-amber-50 text-amber-700 border border-amber-200",
      active: "bg-blue-50 text-blue-700 border border-blue-200",
      completed: "bg-green-50 text-green-700 border border-green-200",
      failed: "bg-red-50 text-red-700 border border-red-200",
      paused: "bg-gray-100 text-gray-700 border border-gray-200",
    };
    return map[state] ?? "bg-gray-100 text-gray-700 border border-gray-200";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Crawler</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={loadAll}
            disabled={loading}
            className="min-w-[96px]"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Health */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600">Trạng thái:</span>
          {health?.ok ? (
            <Badge className="bg-green-50 text-green-700 border border-green-200">
              OK
            </Badge>
          ) : (
            <Badge className="bg-red-50 text-red-700 border border-red-200">
              DOWN
            </Badge>
          )}
          <Separator className="h-6" orientation="vertical" />
          <div className="flex items-center gap-3 text-sm">
            <div>
              <span className="text-gray-600 mr-1">Series:</span>
              <span className="font-medium">
                W {fmt.num(health?.queues?.series.waiting)} • A{" "}
                {fmt.num(health?.queues?.series.active)} • C{" "}
                {fmt.num(health?.queues?.series.completed)} • F{" "}
                {fmt.num(health?.queues?.series.failed)}
              </span>
            </div>
            <Separator className="h-4" orientation="vertical" />
            <div>
              <span className="text-gray-600 mr-1">Chapter:</span>
              <span className="font-medium">
                W {fmt.num(health?.queues?.chapter.waiting)} • A{" "}
                {fmt.num(health?.queues?.chapter.active)} • C{" "}
                {fmt.num(health?.queues?.chapter.completed)} • F{" "}
                {fmt.num(health?.queues?.chapter.failed)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Enqueue form */}
      <Card className="p-4">
        <form
          onSubmit={handleEnqueue}
          className="grid grid-cols-1 gap-4 md:grid-cols-12"
        >
          {/* Source */}
          <div className="md:col-span-3">
            <Label className="mb-2 block">Source</Label>
            <Select value={sourceId} onValueChangeAction={setSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn source" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span>{s.name}</span>
                      {s.domain ? (
                        <span className="text-xs text-gray-500">
                          {s.domain}
                        </span>
                      ) : null}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* URL */}
          <div className="md:col-span-5">
            <Label htmlFor="url" className="mb-2 block">
              URL series
            </Label>
            <Input
              id="url"
              placeholder="https://example.com/some-story"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* External ID */}
          <div className="md:col-span-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="ext" className="mb-2 block">
                External series ID
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-gray-500 underline decoration-dotted cursor-help">
                      Gợi ý
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="max-w-[240px]">
                      Thường là <b>pathname</b> của URL (ví dụ:{" "}
                      <code>/truyen/abc</code>).
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="ext"
              placeholder="/truyen/abc"
              value={extSeriesId}
              onChange={(e) => setExtSeriesId(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Submit */}
          <div className="md:col-span-1 flex items-end">
            <Button type="submit" disabled={enqueueing} className="w-full">
              {enqueueing ? "Enqueue…" : "Enqueue"}
            </Button>
          </div>

          {/* messages */}
          {(msg || err) && (
            <div className="md:col-span-12">
              {msg ? (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  {msg}
                </div>
              ) : null}
              {err ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {err}
                </div>
              ) : null}
            </div>
          )}
        </form>
      </Card>

      {/* Jobs table */}
      <Card className="p-0">
        <Table>
          <TableCaption>Danh sách jobs gần đây</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Job</TableHead>
              <TableHead className="w-[140px]">Queue</TableHead>
              <TableHead className="w-[140px]">State</TableHead>
              <TableHead className="w-[100px]">Progress</TableHead>
              <TableHead className="w-[100px]">Attempts</TableHead>
              <TableHead>Lý do lỗi</TableHead>
              <TableHead className="w-[180px]">Thời gian</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">
                  Không có job nào.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.name}</TableCell>
                  <TableCell>
                    <Badge className="bg-gray-100 text-gray-700 border border-gray-200">
                      {j.queue}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={badgeForState(j.state)}>{j.state}</Badge>
                  </TableCell>
                  <TableCell>
                    {typeof j.progress === "number" ? `${j.progress}%` : "-"}
                  </TableCell>
                  <TableCell>{j.attemptsMade ?? 0}</TableCell>
                  <TableCell
                    className="max-w-[420px] truncate"
                    title={j.failedReason ?? ""}
                  >
                    {j.failedReason ?? ""}
                  </TableCell>
                  <TableCell>{fmt.dt(j.timestamp)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {jobs.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={7} className="text-right">
                  Tổng: {jobs.length}
                </TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </Card>
    </div>
  );
}
