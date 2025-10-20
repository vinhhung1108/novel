import type { Overview } from "@/app/lib/stats";

const METRICS: Array<{ key: keyof Overview; label: string; emoji: string }> = [
  { key: "novels", label: "Truyện", emoji: "📚" },
  { key: "chapters", label: "Chương", emoji: "✏️" },
  { key: "authors", label: "Tác giả", emoji: "🖋️" },
  { key: "tags", label: "Tags", emoji: "🏷️" },
];

export function OverviewCards({ data }: { data: Overview | null }) {
  return (
    <>
      {METRICS.map(({ key, label, emoji }) => (
        <article
          key={key}
          className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span aria-hidden="true">{emoji}</span>
            <span>{label}</span>
          </div>
          <div className="mt-3 text-3xl font-semibold tabular-nums text-zinc-900">
            {data?.[key] ?? 0}
          </div>
        </article>
      ))}
    </>
  );
}
