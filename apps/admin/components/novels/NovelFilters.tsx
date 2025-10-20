import { useState } from "react";

type SortKey = "updated_at" | "title";
type SortOrder = "ASC" | "DESC";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  sort: SortKey;
  onSortChange: (value: SortKey) => void;
  order: SortOrder;
  onOrderChange: (value: SortOrder) => void;
  limit: number;
  onLimitChange: (value: number) => void;
};

const LIMIT_OPTIONS = [6, 12, 24, 48];

export function NovelFilters({
  search,
  onSearchChange,
  sort,
  onSortChange,
  order,
  onOrderChange,
  limit,
  onLimitChange,
}: Props) {
  const [localSearch, setLocalSearch] = useState(search);

  return (
    <section className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center">
      <div className="flex flex-col">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Tìm kiếm
        </label>
        <input
          value={localSearch}
          onChange={(e) => {
            const value = e.target.value;
            setLocalSearch(value);
            onSearchChange(value);
          }}
          placeholder="Nhập tiêu đề hoặc slug…"
          className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
        />
      </div>

      <FilterItem label="Sắp xếp">
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className="rounded-lg border border-zinc-300 px-2 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
        >
          <option value="updated_at">Ngày cập nhật</option>
          <option value="title">Tiêu đề</option>
        </select>
      </FilterItem>

      <FilterItem label="Thứ tự">
        <select
          value={order}
          onChange={(e) => onOrderChange(e.target.value as SortOrder)}
          className="rounded-lg border border-zinc-300 px-2 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
        >
          <option value="DESC">Giảm dần</option>
          <option value="ASC">Tăng dần</option>
        </select>
      </FilterItem>

      <FilterItem label="Hiển thị">
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value) || limit)}
          className="rounded-lg border border-zinc-300 px-2 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
        >
          {LIMIT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}/trang
            </option>
          ))}
        </select>
      </FilterItem>
    </section>
  );
}

function FilterItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
