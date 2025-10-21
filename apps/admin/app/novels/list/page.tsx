"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { NovelFilters } from "@/components/novels/NovelFilters";
import { NovelCard } from "@/components/novels/NovelCard";
import { PaginationControls } from "@/components/novels/PaginationControls";
import { EmptyState } from "@/components/novels/EmptyState";
import { SkeletonGrid } from "@/components/novels/SkeletonGrid";
import type { NovelSummary } from "@/app/lib/novels/types";
import { deleteNovel, listNovels } from "@/services/novels";

const DEFAULT_LIMIT = 12;

type SortKey = "updated_at" | "title";

type SortOrder = "ASC" | "DESC";

export default function NovelsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, getAuthHeader } = useAuth();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [page, setPage] = useState(() => Number(searchParams.get("page") || 1));
  const [limit, setLimit] = useState(() =>
    Number(searchParams.get("limit") || DEFAULT_LIMIT)
  );
  const [sort, setSort] = useState<SortKey>(
    (searchParams.get("sort") as SortKey) || "updated_at"
  );
  const [order, setOrder] = useState<SortOrder>(
    ((searchParams.get("order") || "DESC").toUpperCase() as SortOrder) || "DESC"
  );

  const [items, setItems] = useState<NovelSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("sort", sort);
    params.set("order", order);
    router.replace(`/novels/list?${params.toString()}`);
  }, [debouncedSearch, page, limit, sort, order, router]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / (limit || DEFAULT_LIMIT)));
  }, [total, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const resp = await listNovels({
        page,
        limit,
        sort,
        order,
        q: debouncedSearch,
      });
      setItems(resp.items ?? []);
      setTotal(resp.total ?? 0);
    } catch (err: any) {
      setError(err?.message ?? "Không tải được danh sách truyện");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, sort, order, debouncedSearch]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const handleDelete = useCallback(
    async (novel: NovelSummary) => {
      const ok = window.confirm(
        `Xoá truyện "${novel.title}"?\nHành động này không thể hoàn tác.`
      );
      if (!ok) return;
      try {
        await deleteNovel(novel.id, getAuthHeader);
        await fetchList();
      } catch (err: any) {
        alert(err?.message ?? "Không xoá được truyện");
      }
    },
    [fetchList, getAuthHeader]
  );

  const handleEdit = (novel: NovelSummary) => {
    router.push(`/novels/edit/${encodeURIComponent(novel.slug)}`);
  };

  const handleManageChapters = (novel: NovelSummary) => {
    router.push(`/novels/${encodeURIComponent(novel.slug)}/chapters`);
  };

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-6 pb-12 pt-6">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Quản lý nội dung
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Danh sách truyện
          </h1>
        </div>
        <Link
          href="/novels/new"
          className="ml-auto inline-flex items-center rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
        >
          ➕ Thêm truyện mới
        </Link>
      </header>

      <NovelFilters
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        sort={sort}
        onSortChange={(value) => {
          setSort(value);
          setPage(1);
        }}
        order={order}
        onOrderChange={(value) => {
          setOrder(value);
          setPage(1);
        }}
        limit={limit}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
      />

      {error ? <EmptyState message={error} /> : null}

      {loading ? (
        <SkeletonGrid count={limit} />
      ) : items.length === 0 ? (
        <EmptyState message="Không tìm thấy truyện phù hợp." />
      ) : (
        <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((novel) => (
            <NovelCard
              key={novel.id}
              novel={novel}
              onEdit={handleEdit}
              onManageChapters={handleManageChapters}
              onDelete={handleDelete}
            />
          ))}
        </section>
      )}

      <PaginationControls
        page={page}
        totalPages={totalPages}
        onChange={(nextPage) => setPage(nextPage)}
      />
    </main>
  );
}
