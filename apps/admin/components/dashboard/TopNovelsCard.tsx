import Link from "next/link";
import Time from "@/components/Time";
import { CDN_BASE } from "@/app/lib/novels/constants";
import type { TopItem } from "@/app/lib/stats";

export function TopNovelsCard({ novels }: { novels: TopItem[] }) {
  return (
    <div className="grid gap-4">
      {novels.map((item) => (
        <article
          key={item.novel.id}
          className="flex items-center gap-3 rounded-xl border border-zinc-100 p-3 transition hover:border-zinc-200 hover:bg-zinc-50"
        >
          <div className="h-16 w-12 overflow-hidden rounded-lg bg-zinc-100">
            {item.novel.cover_image_key ? (
              <img
                src={`${CDN_BASE}/${item.novel.cover_image_key}`}
                alt={item.novel.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-xs text-zinc-400">
                No cover
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900">
              {item.novel.title}
            </p>
            <p className="text-xs text-zinc-500">
              Cập nhật <Time value={item.novel.updated_at} withTime />
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums text-zinc-900">
              {item.views}
            </p>
            <p className="text-xs text-zinc-500">lượt</p>
          </div>
          <Link
            href={`/novels/${encodeURIComponent(item.novel.slug)}/chapters`}
            className="text-xs font-medium text-blue-600 transition hover:text-blue-500"
          >
            Quản lý →
          </Link>
        </article>
      ))}
    </div>
  );
}
