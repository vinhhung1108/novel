export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="h-64 animate-pulse rounded-xl bg-zinc-100" />
      ))}
    </div>
  );
}
