"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { apiUrl } from "@/lib/api";
import { slugifySafe } from "@/lib/slug";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
};

type ListResp =
  | Category[]
  | {
      items: Category[];
      total: number;
      page: number;
      limit: number;
    };

function toItems(resp: ListResp): Category[] {
  return Array.isArray(resp) ? resp : (resp?.items ?? []);
}

const CARD = "bg-white border border-gray-200 rounded-xl";

type EditState = {
  open: boolean;
  id?: string;
  name: string;
  slug: string;
  autoSlug: boolean;
  description: string;
  submitting: boolean;
  error: string;
};

type Action =
  | { type: "open_new" }
  | { type: "open_edit"; payload: Category }
  | { type: "close" }
  | { type: "set"; field: keyof EditState; value: any }
  | { type: "setMany"; values: Partial<EditState> };

const initialEdit: EditState = {
  open: false,
  name: "",
  slug: "",
  autoSlug: true,
  description: "",
  submitting: false,
  error: "",
};

function editReducer(state: EditState, action: Action): EditState {
  switch (action.type) {
    case "open_new":
      return { ...initialEdit, open: true };
    case "open_edit":
      return {
        ...initialEdit,
        open: true,
        id: action.payload.id,
        name: action.payload.name,
        slug: action.payload.slug,
        autoSlug: false,
        description: action.payload.description ?? "",
      };
    case "close":
      return initialEdit;
    case "set":
      return { ...state, [action.field]: action.value };
    case "setMany":
      return { ...state, ...action.values };
    default:
      return state;
  }
}

export default function CategoriesPage() {
  const { token, getAuthHeader } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();

  // query state
  const [q, setQ] = useState(sp.get("q") || "");
  const [page, setPage] = useState<number>(Number(sp.get("page") || 1));
  const [limit, setLimit] = useState<number>(Number(sp.get("limit") || 30));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);

  // selection for bulk delete
  const [selected, setSelected] = useState<string[]>([]);
  const allChecked = useMemo(
    () => items.length > 0 && selected.length === items.length,
    [items, selected]
  );
  const someChecked = useMemo(
    () => selected.length > 0 && selected.length < items.length,
    [items, selected]
  );

  // edit/create modal
  const [edit, dispatch] = useReducer(editReducer, initialEdit);

  // guard token
  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  // sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    params.set("page", String(page));
    params.set("limit", String(limit));
    router.replace(`/categories?${params.toString()}`);
  }, [q, page, limit, router]);

  // debounce q
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  // fetch list
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const url = new URL(apiUrl("/categories"));
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(limit));
        if (debouncedQ.trim()) url.searchParams.set("q", debouncedQ.trim());
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
          setErr(`Không tải được thể loại (${res.status})`);
          setItems([]);
          setTotal(0);
        } else {
          const data = (await res.json()) as ListResp;
          const list = toItems(data);
          setItems(list);
          setTotal(Array.isArray(data) ? list.length : (data.total ?? 0));
          setSelected([]); // reset chọn khi đổi trang/list
        }
      } catch (e: any) {
        setErr(e?.message ?? "Lỗi kết nối");
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [page, limit, debouncedQ]);

  // total pages
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / (limit || 30))),
    [total, limit]
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  // auto slug in modal
  useEffect(() => {
    if (!edit.open || !edit.autoSlug) return;
    const next = slugifySafe(edit.name);
    if (next !== edit.slug) {
      dispatch({ type: "set", field: "slug", value: next });
    }
  }, [edit.name, edit.autoSlug, edit.open, edit.slug]);

  // actions
  async function createOrUpdate() {
    if (!token) return;
    if (!edit.name.trim() || !edit.slug.trim()) {
      dispatch({
        type: "set",
        field: "error",
        value: "Tên và slug là bắt buộc",
      });
      return;
    }

    dispatch({ type: "set", field: "submitting", value: true });
    dispatch({ type: "set", field: "error", value: "" });

    try {
      const payload = {
        name: edit.name.trim(),
        slug: edit.slug.trim(),
        description: edit.description.trim() || undefined,
      };

      let res: Response;
      if (edit.id) {
        // update
        res = await fetch(apiUrl(`/categories/${edit.id}`), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify(payload),
        });
      } else {
        // create
        res = await fetch(apiUrl("/categories"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`${res.status} ${t}`);
      }

      // refresh list (giữ trang hiện tại)
      const url = new URL(apiUrl("/categories"));
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));
      if (debouncedQ.trim()) url.searchParams.set("q", debouncedQ.trim());
      const listRes = await fetch(url.toString(), { cache: "no-store" });
      const data = (await listRes.json()) as ListResp;
      setItems(toItems(data));
      setTotal(
        Array.isArray(data) ? toItems(data).length : (data as any).total
      );
      dispatch({ type: "close" });
    } catch (e: any) {
      dispatch({
        type: "set",
        field: "error",
        value: e?.message ?? "Lỗi lưu dữ liệu",
      });
    } finally {
      dispatch({ type: "set", field: "submitting", value: false });
    }
  }

  async function removeOne(id: string) {
    if (!token) return;
    if (!confirm("Xoá thể loại này?")) return;

    const res = await fetch(apiUrl(`/categories/${id}`), {
      method: "DELETE",
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      const t = await res.text();
      alert(`Xoá thất bại: ${res.status} ${t}`);
      return;
    }
    // local update
    setItems((prev) => prev.filter((c) => c.id !== id));
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  async function removeBulk() {
    if (selected.length === 0) return;
    if (!confirm(`Xoá ${selected.length} thể loại đã chọn?`)) return;

    // Thực hiện tuần tự để đơn giản; có thể Promise.all nếu muốn
    for (const id of selected) {
      const res = await fetch(apiUrl(`/categories/${id}`), {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) {
        const t = await res.text();
        alert(`Xoá thất bại (id=${id}): ${res.status} ${t}`);
        // tiếp tục xoá id khác
      }
    }
    setItems((prev) => prev.filter((c) => !selected.includes(c.id)));
    setSelected([]);
  }

  const toggleAll = () => {
    if (allChecked) setSelected([]);
    else setSelected(items.map((x) => x.id));
  };

  const disabledSubmit =
    !edit.name.trim() || !edit.slug.trim() || edit.submitting;

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Thể loại</h1>
        <button
          onClick={() => dispatch({ type: "open_new" })}
          className="px-3 py-2 rounded-lg bg-black text-white"
        >
          ➕ Thêm thể loại
        </button>
      </div>

      {/* Bộ lọc */}
      <section className={`${CARD} p-3 flex items-center gap-3`}>
        <input
          className="border rounded-lg px-3 py-2 min-w-[260px] flex-1"
          placeholder="Tìm theo tên hoặc slug…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="text-sm">
          Limit{" "}
          <select
            className="border rounded-lg px-2 py-1 ml-1"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[30, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="text-sm text-gray-700">
        {loading ? "Đang tải…" : `Tổng: ${total} • Trang ${page}/${totalPages}`}
      </div>

      {/* Danh sách */}
      <section className={`${CARD} overflow-hidden`}>
        {loading ? (
          <div className="p-4">Đang tải…</div>
        ) : err ? (
          <div className="p-4 text-red-600">{err}</div>
        ) : items.length === 0 ? (
          <div className="p-4">Chưa có thể loại.</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked;
                    }}
                    onChange={toggleAll}
                  />
                </th>
                <th className="p-3">Tên</th>
                <th className="p-3">Slug</th>
                <th className="p-3 w-40">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="p-3 align-top">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelected((prev) => [...prev, c.id]);
                        } else {
                          setSelected((prev) => prev.filter((x) => x !== c.id));
                        }
                      }}
                    />
                  </td>
                  <td className="p-3 align-top">
                    <div className="font-medium">{c.name}</div>
                    {c.description ? (
                      <div className="text-sm text-gray-600">
                        {c.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3 align-top">
                    <code className="text-sm text-gray-700">{c.slug}</code>
                  </td>
                  <td className="p-3 align-top">
                    <div className="flex gap-3">
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() =>
                          dispatch({ type: "open_edit", payload: c })
                        }
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => removeOne(c.id)}
                      >
                        🗑️ Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Bulk actions + phân trang */}
      <section className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            disabled={selected.length === 0}
            onClick={removeBulk}
            className="px-3 py-2 rounded-lg border disabled:opacity-50"
          >
            Xoá đã chọn ({selected.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(1)}
            disabled={page <= 1}
            className="px-3 py-2 rounded-lg border disabled:opacity-50"
          >
            « Đầu
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-2 rounded-lg border disabled:opacity-50"
          >
            ← Trước
          </button>
          <span className="text-sm">
            Trang {page}/{totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-2 rounded-lg border disabled:opacity-50"
          >
            Sau →
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
            className="px-3 py-2 rounded-lg border disabled:opacity-50"
          >
            Cuối »
          </button>
        </div>
      </section>

      {/* Modal tạo/sửa */}
      {edit.open && (
        <div
          className="fixed inset-0 bg-black/30 grid place-items-center p-4"
          onClick={() => dispatch({ type: "close" })}
        >
          <div
            className="w-[min(700px,96vw)] bg-white rounded-xl p-5 grid gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold m-0">
              {edit.id ? "Sửa thể loại" : "Thêm thể loại"}
            </h3>

            <div className="grid gap-3">
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="Tên thể loại"
                value={edit.name}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    field: "name",
                    value: e.target.value,
                  })
                }
              />

              <div className="flex items-center gap-3">
                <input
                  className="border rounded-lg px-3 py-2 flex-1"
                  placeholder="Slug"
                  value={edit.slug}
                  onChange={(e) => {
                    dispatch({
                      type: "set",
                      field: "slug",
                      value: e.target.value,
                    });
                    dispatch({ type: "set", field: "autoSlug", value: false });
                  }}
                />
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={edit.autoSlug}
                    onChange={(e) =>
                      dispatch({
                        type: "set",
                        field: "autoSlug",
                        value: e.target.checked,
                      })
                    }
                  />
                  Auto
                </label>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg border"
                  onClick={() =>
                    dispatch({
                      type: "set",
                      field: "slug",
                      value: slugifySafe(edit.name),
                    })
                  }
                >
                  Tạo từ tên
                </button>
              </div>

              <textarea
                className="border rounded-lg px-3 py-2 min-h-28"
                placeholder="Mô tả"
                value={edit.description}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    field: "description",
                    value: e.target.value,
                  })
                }
              />
            </div>

            {edit.error && <p className="text-red-600 text-sm">{edit.error}</p>}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border"
                onClick={() => dispatch({ type: "close" })}
              >
                Huỷ
              </button>
              <button
                type="button"
                disabled={disabledSubmit}
                className="px-3 py-2 rounded-lg bg-black text-white disabled:opacity-50"
                onClick={createOrUpdate}
              >
                {edit.submitting
                  ? edit.id
                    ? "Đang lưu…"
                    : "Đang tạo…"
                  : edit.id
                    ? "Lưu thay đổi"
                    : "Tạo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
