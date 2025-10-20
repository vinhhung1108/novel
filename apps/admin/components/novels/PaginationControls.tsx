type Props = {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
};

export function PaginationControls({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  const cannotPrev = page <= 1;
  const cannotNext = page >= totalPages;

  return (
    <nav className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-zinc-500">
        Trang <span className="font-medium text-zinc-800">{page}</span> trên{" "}
        <span className="font-medium text-zinc-800">{totalPages}</span>
      </div>
      <div className="flex items-center gap-2">
        <PageButton disabled={cannotPrev} onClick={() => onChange(1)}>
          « Đầu
        </PageButton>
        <PageButton disabled={cannotPrev} onClick={() => onChange(page - 1)}>
          ‹ Trước
        </PageButton>
        <PageButton disabled={cannotNext} onClick={() => onChange(page + 1)}>
          Sau ›
        </PageButton>
        <PageButton disabled={cannotNext} onClick={() => onChange(totalPages)}>
          Cuối »
        </PageButton>
      </div>\n    </nav>
  );
}

function PageButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
