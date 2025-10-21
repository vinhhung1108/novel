"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  createSource,
  enqueueChapter,
  enqueueSeries,
  fetchSources,
  fetchJobStatus,
  CrawlSource,
  CrawlJobStatusResponse,
  CrawlQueueJobs,
  CrawlJobItem,
  JobStatusKey,
} from "@/services/crawl";

type AlertState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

type SourceFormState = {
  name: string;
  baseUrl: string;
};

type SeriesFormState = {
  sourceId: string;
  extSeriesId: string;
  url: string;
};

type ChapterFormState = {
  sourceId: string;
  seriesId: string;
  extChapterId: string;
  url: string;
  indexNo: string;
};

const cardCls =
  "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4";

const STATUS_ORDER: JobStatusKey[] = [
  "waiting",
  "active",
  "delayed",
  "failed",
  "completed",
];

export default function CrawlAdminPage() {
  const { token, getAuthHeader } = useAuth();
  const router = useRouter();

  const [sources, setSources] = useState<CrawlSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [alert, setAlert] = useState<AlertState>(null);

  const [sourceForm, setSourceForm] = useState<SourceFormState>({
    name: "",
    baseUrl: "",
  });
  const [seriesForm, setSeriesForm] = useState<SeriesFormState>({
    sourceId: "",
    extSeriesId: "",
    url: "",
  });
  const [chapterForm, setChapterForm] = useState<ChapterFormState>({
    sourceId: "",
    seriesId: "",
    extChapterId: "",
    url: "",
    indexNo: "",
  });

  const [creatingSource, setCreatingSource] = useState(false);
  const [enqueueSeriesPending, setEnqueueSeriesPending] = useState(false);
  const [enqueueChapterPending, setEnqueueChapterPending] = useState(false);
  const [jobStatus, setJobStatus] = useState<CrawlJobStatusResponse | null>(
    null
  );
  const [jobLoading, setJobLoading] = useState(false);
  const [jobError, setJobError] = useState("");
  const [lastJobRefresh, setLastJobRefresh] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<CrawlJobItem | null>(null);

  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  const loadSources = useCallback(async () => {
    try {
      setLoadingSources(true);
      setSourceError("");
      const res = await fetchSources(getAuthHeader);
      const list = res?.items ?? [];
      setSources(list);
      if (list.length > 0) {
        setSeriesForm((prev) =>
          prev.sourceId
            ? prev
            : { ...prev, sourceId: prev.sourceId || list[0].id }
        );
        setChapterForm((prev) =>
          prev.sourceId
            ? prev
            : { ...prev, sourceId: prev.sourceId || list[0].id }
        );
      }
    } catch (err: any) {
      setSourceError(
        err?.message ? `Không tải được nguồn: ${err.message}` : "Lỗi tải nguồn"
      );
      setSources([]);
    } finally {
      setLoadingSources(false);
    }
  }, [getAuthHeader]);

  const loadJobStatus = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token) return;
      if (!options?.silent) {
        setJobLoading(true);
      }
      try {
        const res = await fetchJobStatus(getAuthHeader);
        setJobStatus(res);
        setJobError("");
        setLastJobRefresh(Date.now());
      } catch (err: any) {
        setJobError(
          err?.message
            ? `Không tải được trạng thái job: ${err.message}`
            : "Không tải được trạng thái job"
        );
        setJobStatus(null);
      } finally {
        if (!options?.silent) {
          setJobLoading(false);
        }
      }
    },
    [getAuthHeader, token]
  );

  useEffect(() => {
    if (!token) return;
    void loadSources();
    void loadJobStatus();
    const timer = window.setInterval(() => {
      void loadJobStatus({ silent: true });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [token, loadSources, loadJobStatus]);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 5000);
    return () => clearTimeout(t);
  }, [alert]);

  const hasSources = sources.length > 0;
  const sourceOptions = useMemo(
    () =>
      sources.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name} • {s.baseUrl}
        </option>
      )),
    [sources]
  );

  function showAlert(type: "success" | "error", message: string) {
    setAlert({ type, message });
  }

  async function handleCreateSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = sourceForm.name.trim();
    const baseUrl = sourceForm.baseUrl.trim();
    if (!name || !baseUrl) {
      showAlert("error", "Tên và Base URL là bắt buộc");
      return;
    }
    try {
      setCreatingSource(true);
      await createSource({ name, baseUrl }, getAuthHeader);
      setSourceForm({ name: "", baseUrl: "" });
      showAlert("success", "Đã lưu nguồn crawl");
      await loadSources();
    } catch (err: any) {
      showAlert(
        "error",
        err?.message
          ? `Không thể lưu nguồn: ${truncate(err.message)}`
          : "Không thể lưu nguồn"
      );
    } finally {
      setCreatingSource(false);
    }
  }

  async function handleEnqueueSeries(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { sourceId, extSeriesId, url } = seriesForm;
    if (!sourceId || !extSeriesId.trim() || !url.trim()) {
      showAlert("error", "Cần chọn nguồn, nhập mã series và URL");
      return;
    }
    try {
      setEnqueueSeriesPending(true);
      const res = await enqueueSeries(
        {
          sourceId,
          extSeriesId: extSeriesId.trim(),
          url: url.trim(),
        },
        getAuthHeader
      );
      showAlert(
        "success",
        res?.jobId ? `Đã enqueue series ${res.jobId}` : "Đã enqueue series"
      );
      setSeriesForm((prev) => ({ ...prev, extSeriesId: "", url: "" }));
      void loadJobStatus({ silent: true });
    } catch (err: any) {
      showAlert(
        "error",
        err?.message
          ? `Không thể enqueue series: ${truncate(err.message)}`
          : "Không thể enqueue series"
      );
    } finally {
      setEnqueueSeriesPending(false);
    }
  }

  async function handleEnqueueChapter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { sourceId, seriesId, extChapterId, url, indexNo } = chapterForm;
    if (!sourceId || !seriesId.trim() || !extChapterId.trim() || !url.trim()) {
      showAlert("error", "Cần chọn nguồn và nhập đủ thông tin chương");
      return;
    }
    const idx = indexNo.trim()
      ? Number.parseInt(indexNo.trim(), 10)
      : undefined;
    if (Number.isNaN(idx)) {
      showAlert("error", "IndexNo phải là số hợp lệ");
      return;
    }
    try {
      setEnqueueChapterPending(true);
      const res = await enqueueChapter(
        {
          sourceId,
          seriesId: seriesId.trim(),
          extChapterId: extChapterId.trim(),
          url: url.trim(),
          indexNo: idx,
        },
        getAuthHeader
      );
      showAlert(
        "success",
        res?.jobId ? `Đã enqueue chương ${res.jobId}` : "Đã enqueue chương"
      );
      setChapterForm((prev) => ({
        ...prev,
        extChapterId: "",
        url: "",
        indexNo: "",
      }));
      void loadJobStatus({ silent: true });
    } catch (err: any) {
      showAlert(
        "error",
        err?.message
          ? `Không thể enqueue chương: ${truncate(err.message)}`
          : "Không thể enqueue chương"
      );
    } finally {
      setEnqueueChapterPending(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 pb-12 pt-6">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Crawler
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Quản lý Crawl
          </h1>
        </div>
      </header>

      {alert ? (
        <div
          className={`rounded-lg border p-4 text-sm ${
            alert.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {alert.message}
        </div>
      ) : null}

      <section className={cardCls}>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Nguồn hỗ trợ</h2>
            <p className="text-sm text-zinc-500">
              Thêm nguồn crawler và xem danh sách hiện có.
            </p>
          </div>
          <button
            onClick={() => void loadSources()}
            className="ml-auto inline-flex items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            🔄 Làm mới
          </button>
        </div>

        <form
          onSubmit={handleCreateSource}
          className="grid gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4 sm:grid-cols-[2fr,2fr,auto]"
        >
          <label className="flex flex-col text-sm text-zinc-600">
            Tên nguồn
            <input
              type="text"
              value={sourceForm.name}
              onChange={(e) =>
                setSourceForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none"
              placeholder="Ví dụ: TruyenCV"
            />
          </label>
          <label className="flex flex-col text-sm text-zinc-600">
            Base URL
            <input
              type="url"
              value={sourceForm.baseUrl}
              onChange={(e) =>
                setSourceForm((prev) => ({ ...prev, baseUrl: e.target.value }))
              }
              className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none"
              placeholder="https://example.com"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={creatingSource}
              className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {creatingSource ? "Đang lưu..." : "Lưu nguồn"}
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-dashed border-zinc-200">
          {loadingSources ? (
            <div className="p-6 text-sm text-zinc-500">Đang tải nguồn...</div>
          ) : sourceError ? (
            <div className="p-6 text-sm text-rose-600">{sourceError}</div>
          ) : hasSources ? (
            <ul className="divide-y divide-zinc-100">
              {sources.map((source) => (
                <li
                  key={source.id}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[2fr,2fr,auto]"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{source.name}</p>
                    <p className="text-xs text-zinc-500">{source.id}</p>
                  </div>
                  <div className="text-sm text-zinc-600">{source.baseUrl}</div>
                  <div className="text-sm text-zinc-500">
                    {source.createdAt
                      ? new Date(source.createdAt).toLocaleString()
                      : "-"}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 text-sm text-zinc-500">
              Chưa có nguồn nào. Thêm mới ở form phía trên.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className={cardCls}>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Enqueue Series
            </h2>
            <p className="text-sm text-zinc-500">
              Tạo job crawl toàn bộ thông tin series và danh sách chương.
            </p>
          </div>
          <form className="grid gap-3" onSubmit={handleEnqueueSeries}>
            <label className="flex flex-col text-sm text-zinc-600">
              Nguồn
              <select
                disabled={!hasSources}
                value={seriesForm.sourceId}
                onChange={(e) =>
                  setSeriesForm((prev) => ({
                    ...prev,
                    sourceId: e.target.value,
                  }))
                }
                className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
              >
                {sourceOptions.length ? (
                  <option key="placeholder" value="" disabled>
                    Chọn nguồn
                  </option>
                ) : null}
                {sourceOptions}
              </select>
            </label>

            <label className="flex flex-col text-sm text-zinc-600">
              External Series ID
              <input
                type="text"
                value={seriesForm.extSeriesId}
                onChange={(e) =>
                  setSeriesForm((prev) => ({
                    ...prev,
                    extSeriesId: e.target.value,
                  }))
                }
                className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none"
                placeholder="ví dụ: /truyen/abc"
              />
            </label>

            <label className="flex flex-col text-sm text-zinc-600">
              URL
              <input
                type="url"
                value={seriesForm.url}
                onChange={(e) =>
                  setSeriesForm((prev) => ({ ...prev, url: e.target.value }))
                }
                className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none"
                placeholder="https://example.com/truyen/abc"
              />
            </label>

            <button
              type="submit"
              disabled={enqueueSeriesPending || !hasSources}
              className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {enqueueSeriesPending ? "Đang enqueue..." : "Enqueue series"}
            </button>
          </form>
        </div>

        <div className={cardCls}>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Enqueue Chapter
            </h2>
            <p className="text-sm text-zinc-500">
              Tạo job crawl nội dung một chương cụ thể.
            </p>
          </div>

          <form className="grid gap-3" onSubmit={handleEnqueueChapter}>
            <label className="flex flex-col text-sm text-zinc-600">
              Nguồn
              <select
                disabled={!hasSources}
                value={chapterForm.sourceId}
                onChange={(e) =>
                  setChapterForm((prev) => ({
                    ...prev,
                    sourceId: e.target.value,
                  }))
                }
                className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
              >
                {sourceOptions.length ? (
                  <option key="placeholder" value="" disabled>
                    Chọn nguồn
                  </option>
                ) : null}
                {sourceOptions}
              </select>
            </label>

            <label className="flex flex-col text-sm text-zinc-600">
              Series ID (internal UUID)
              <input
                type="text"
                value={chapterForm.seriesId}
                onChange={(e) =>
                  setChapterForm((prev) => ({
                    ...prev,
                    seriesId: e.target.value,
                  }))
                }
                className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none"
                placeholder="UUID của novels.id"
              />
            </label>

            <label className="flex flex-col text-sm text-zinc-600">
              External Chapter ID
              <input
                type="text"
                value={chapterForm.extChapterId}
                onChange={(e) =>
                  setChapterForm((prev) => ({
                    ...prev,
                    extChapterId: e.target.value,
                  }))
                }
                className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none"
                placeholder="ví dụ: /truyen/abc/chuong-1"
              />
            </label>

            <label className="flex flex-col text-sm text-zinc-600">
              URL
              <input
                type="url"
                value={chapterForm.url}
                onChange={(e) =>
                  setChapterForm((prev) => ({ ...prev, url: e.target.value }))
                }
                className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none"
                placeholder="https://example.com/chuong/1"
              />
            </label>

            <label className="flex flex-col text-sm text-zinc-600">
              IndexNo (tùy chọn)
              <input
                type="number"
                min={1}
                value={chapterForm.indexNo}
                onChange={(e) =>
                  setChapterForm((prev) => ({
                    ...prev,
                    indexNo: e.target.value,
                  }))
                }
                className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none"
                placeholder="Để trống để auto"
              />
            </label>

            <button
              type="submit"
              disabled={enqueueChapterPending || !hasSources}
              className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {enqueueChapterPending ? "Đang enqueue..." : "Enqueue chapter"}
            </button>
          </form>
        </div>
      </section>

      <section className={cardCls}>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Trạng thái hàng đợi
            </h2>
            <p className="text-sm text-zinc-500">
              Theo dõi các job đang chờ, đang chạy, hoàn thành hoặc lỗi.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm text-zinc-500">
            <span>
              Cập nhật:{" "}
              {lastJobRefresh
                ? new Date(lastJobRefresh).toLocaleTimeString()
                : "Chưa có"}
            </span>
            <button
              type="button"
              onClick={() => void loadJobStatus()}
              className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
            >
              🔄 Làm mới
            </button>
          </div>
        </div>

        {jobLoading && !jobStatus ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-40 animate-pulse rounded-xl bg-zinc-100" />
            <div className="h-40 animate-pulse rounded-xl bg-zinc-100" />
          </div>
        ) : jobError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {jobError}
          </div>
        ) : jobStatus ? (
          <div className="grid gap-4 md:grid-cols-2">
            <QueueStatusCard
              title="Series Queue"
              data={jobStatus.series}
              onSelectJob={setSelectedJob}
            />
            <QueueStatusCard
              title="Chapter Queue"
              data={jobStatus.chapter}
              onSelectJob={setSelectedJob}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
            Chưa có dữ liệu job để hiển thị.
          </div>
        )}
      </section>

      {selectedJob ? (
        <JobDetailDialog
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      ) : null}
    </main>
  );
}

function statusBadgeClasses(status: JobStatusKey) {
  switch (status) {
    case "waiting":
      return "bg-amber-100 text-amber-700";
    case "active":
      return "bg-emerald-100 text-emerald-700";
    case "delayed":
      return "bg-sky-100 text-sky-700";
    case "failed":
      return "bg-rose-100 text-rose-700";
    case "completed":
      return "bg-zinc-900 text-white";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

function statusLabel(status: JobStatusKey) {
  switch (status) {
    case "waiting":
      return "Chờ";
    case "active":
      return "Đang chạy";
    case "delayed":
      return "Delay";
    case "failed":
      return "Lỗi";
    case "completed":
      return "Xong";
    default:
      return status;
  }
}

function describeJob(job: CrawlJobItem): string {
  const map =
    job.data && typeof job.data === "object"
      ? (job.data as Record<string, unknown>)
      : {};
  const candidates = [
    typeof map.title === "string" ? map.title : null,
    typeof map.extChapterId === "string" ? map.extChapterId : null,
    typeof map.extSeriesId === "string" ? map.extSeriesId : null,
    typeof map.seriesId === "string" ? map.seriesId : null,
    typeof map.url === "string" ? map.url : null,
    typeof job.returnValue === "string" ? job.returnValue : null,
  ];
  const found = candidates.find((v) => v && v.trim());
  return found ?? job.name;
}

function formatTimestamp(ts?: number | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "—";
  }
}

function formatDateTime(ts?: number | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
}

function prettyJSON(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}

function QueueStatusCard({
  title,
  data,
  onSelectJob,
}: {
  title: string;
  data: CrawlQueueJobs | undefined;
  onSelectJob: (job: CrawlJobItem) => void;
}) {
  const latest = STATUS_ORDER.flatMap((state) => data?.[state] ?? []).slice(
    0,
    10
  );

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 p-4">
      <div>
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {STATUS_ORDER.map((state) => {
          const count = data?.[state]?.length ?? 0;
          return (
            <div
              key={state}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
            >
              <div className="text-xs uppercase text-zinc-500">
                {statusLabel(state)}
              </div>
              <div className="text-lg font-semibold text-zinc-900">
                {count}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-zinc-200">
        {latest.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">Không có job.</div>
        ) : (
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">Trạng thái</th>
                <th className="px-3 py-2 text-left">Job</th>
                <th className="px-3 py-2 text-left">Lần thử</th>
                <th className="px-3 py-2 text-left">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {latest.map((job) => (
                <tr
                  key={`${job.id}-${job.status}-${job.timestamp}`}
                  onClick={() => onSelectJob(job)}
                  className="cursor-pointer transition hover:bg-zinc-50"
                >
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClasses(
                        job.status
                      )}`}
                    >
                      {statusLabel(job.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-zinc-900">
                      {truncate(describeJob(job), 80)}
                    </div>
                    <div className="text-xs text-zinc-500">ID: {job.id}</div>
                    {job.failedReason ? (
                      <div className="text-xs text-rose-600">
                        ⚠ {truncate(job.failedReason, 100)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top text-sm text-zinc-600">
                    {job.attemptsMade}
                    {job.progress !== null ? (
                      <span className="ml-1 text-xs text-zinc-500">
                        ({job.progress}%)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top text-sm text-zinc-600">
                    <div>Queue: {formatTimestamp(job.timestamp)}</div>
                    <div>
                      Update:{" "}
                      {formatTimestamp(job.finishedOn ?? job.processedOn)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function JobDetailDialog({
  job,
  onClose,
}: {
  job: CrawlJobItem;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <p className="text-xs uppercase text-zinc-500">Chi tiết job</p>
            <h3 className="text-lg font-semibold text-zinc-900">
              {describeJob(job)}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            Đóng
          </button>
        </header>

        <div className="grid gap-4 overflow-auto px-6 py-5">
          <section className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm sm:grid-cols-2">
            <InfoRow label="Trạng thái" value={statusLabel(job.status)} />
            <InfoRow label="Queue" value={formatDateTime(job.timestamp)} />
            <InfoRow
              label="Bắt đầu"
              value={formatDateTime(job.processedOn)}
            />
            <InfoRow
              label="Hoàn thành"
              value={formatDateTime(job.finishedOn)}
            />
            <InfoRow label="Attempts" value={String(job.attemptsMade)} />
            <InfoRow
              label="Progress"
              value={
                job.progress !== null ? `${job.progress}%` : job.status === "completed" ? "100%" : "—"
              }
            />
            <InfoRow label="Job ID" value={job.id} />
            <InfoRow label="Tên job" value={job.name} />
          </section>

          {job.failedReason ? (
            <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <h4 className="mb-2 text-sm font-semibold text-rose-800">
                Lý do lỗi
              </h4>
              <p className="whitespace-pre-wrap break-words">
                {job.failedReason}
              </p>
            </section>
          ) : null}

          {job.stacktrace.length ? (
            <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
              <h4 className="mb-2 text-sm font-semibold text-rose-800">
                Stacktrace
              </h4>
              <pre className="overflow-auto whitespace-pre-wrap">
                {job.stacktrace.join("\n")}
              </pre>
            </section>
          ) : null}

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-zinc-700">
              Payload (data)
            </h4>
            <pre className="max-h-60 overflow-auto rounded-lg border border-zinc-200 bg-zinc-900/95 p-3 text-xs text-zinc-100">
              {prettyJSON(job.data)}
            </pre>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-zinc-700">
              Return value
            </h4>
            <pre className="max-h-60 overflow-auto rounded-lg border border-zinc-200 bg-zinc-900/95 p-3 text-xs text-zinc-100">
              {prettyJSON(job.returnValue)}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase text-zinc-500">{label}</span>
      <span className="truncate text-sm text-zinc-800">{value}</span>
    </div>
  );
}

function truncate(input: string, max = 160) {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}…`;
}
