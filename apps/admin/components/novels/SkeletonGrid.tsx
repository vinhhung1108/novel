export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="h-72 animate-pulse rounded-2xl border border-transparent bg-zinc-100"
        />
      ))}
    </div>
  );
}
