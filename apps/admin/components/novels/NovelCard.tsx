import Link from "next/link";
import Time from "@/components/Time";
import { CDN_BASE } from "@/app/lib/novels/constants";
import type { NovelSummary } from "@/app/lib/novels/types";

type Props = {
  novel: NovelSummary;
  onEdit: (novel: NovelSummary) => void;
  onManageChapters: (novel: NovelSummary) => void;
  onDelete: (novel: NovelSummary) => void;
};

export function NovelCard({ novel, onEdit, onManageChapters, onDelete }: Props) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300">
      <div className="relative h-48 overflow-hidden rounded-t-2xl bg-zinc-100">
        {novel.cover_image_key ? (
          <img
            src={`${CDN_BASE}/${novel.cover_image_key}`}
            alt={novel.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-zinc-400">
            Không có bìa
          </div>
        )}
        {novel.status ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-700 shadow">
            {renderStatus(novel.status)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-zinc-900">
            {novel.title}
          </h2>
          <p className="truncate text-xs text-zinc-500">/{novel.slug}</p>
        </div>

        {novel.description ? (
          <p className="line-clamp-3 text-sm text-zinc-600">
            {novel.description}
          </p>
        ) : null}

        <div className="mt-auto space-y-1 text-xs text-zinc-500">
          {novel.words_count ? (
            <div>
              Tổng từ: <span className="font-medium text-zinc-700">{novel.words_count}</span>
            </div>
          ) : null}
          <div>
            Cập nhật <Time value={novel.updated_at} withTime />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => onEdit(novel)}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            ✏️ Sửa
          </button>
          <button
            onClick={() => onManageChapters(novel)}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            📖 Chương
          </button>
          <button
            onClick={() => onDelete(novel)}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            🗑️ Xoá
          </button>
        </div>
      </div>
    </article>
  );
}

function renderStatus(status: string) {
  switch (status) {
    case "completed":
      return "Hoàn thành";
    case "hiatus":
      return "Tạm dừng";
    default:
      return "Đang ra";
  }
}
