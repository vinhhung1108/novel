import { useEffect, useState } from "react";
import type { SlugStatus } from "@/app/lib/novels/types";
import { apiUrl } from "@/app/lib/api";

export function useSlugAvailability(
  input: string,
  current?: string
): SlugStatus {
  const [status, setStatus] = useState<SlugStatus>("idle");
  const slug = useDebouncedValue(input.trim(), 350);

  useEffect(() => {
    if (!slug) return void setStatus("idle");
    if (current && slug === current) return void setStatus("available");
    if (!/^[a-z0-9-]+$/.test(slug)) return void setStatus("invalid");

    let cancelled = false;
    (async () => {
      setStatus("checking");
      try {
        let res = await fetch(
          apiUrl(`/novels/slug-exists/${encodeURIComponent(slug)}`),
          { cache: "no-store" }
        );
        if (res.status === 404) {
          res = await fetch(
            apiUrl(`/novels/slug-exists?slug=${encodeURIComponent(slug)}`),
            { cache: "no-store" }
          );
        }
        if (!res.ok) throw new Error("slug check failed");
        const data = await res.json();
        if (!cancelled)
          setStatus(Boolean(data?.exists) ? "taken" : "available");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, current]);
  return status;
}
// small shared util (can live here or separate)
export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
}
