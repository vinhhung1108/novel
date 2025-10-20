import { Fragment } from "react";

type Props = {
  rows: number;
  repeat?: number;
  height?: string;
};

export function SkeletonBlock({ rows, repeat = 1, height }: Props) {
  return (
    <>
      {Array.from({ length: repeat }).map((_, idx) => (
        <article
          key={idx}
          className="animate-pulse rounded-2xl border border-transparent bg-zinc-100/80 p-4"
        >
          {Array.from({ length: rows }).map((__, rowIdx) => (
            <Fragment key={rowIdx}>
              <div
                className={`${height ?? "h-4"} mb-2 rounded bg-zinc-200`}
                style={{ width: rowIdx % 2 === 0 ? "100%" : "75%" }}
              />
            </Fragment>
          ))}
        </article>
      ))}
    </>
  );
}
