"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { apiUrl } from "@/lib/api";

// ────────────────────────────────────────────────────────────
// Utils nhỏ gọn tại chỗ
// ────────────────────────────────────────────────────────────
function slugifySafe(input: string): string {
  if (!input) return "";
  return input
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
type Tag = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
};

type ListResp = { items: Tag[]; total: number; page: number; limit: number };

// ────────────────────────────────────────────────────────────
// Create form reducer
// ────────────────────────────────────────────────────────────
type CreateState = {
  name: string;
  slug: string;
  autoSlug: boolean;
  description: string;
};
type CreateAction =
  | { type: "set"; field: keyof CreateState; value: any }
  | { type: "reset" };

const CREATE_INIT: CreateState = {
  name: "",
  slug: "",
  autoSlug: true,
  description: "",
};

function createReducer(state: CreateState, action: CreateAction): CreateState {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "reset":
      return CREATE_INIT;
    default:
      return state;
  }
}

// ────────────────────────────────────────────────────────────
// Edit modal reducer
// ────────────────────────────────────────────────────────────
type EditState = {
  id: string | null;
  open: boolean;
  name: string;
  slug: string;
  description: string;
  autoSlug: boolean;
};
type EditAction =
  | { type: "open"; tag: Tag }
  | { type: "close" }
  | { type: "set"; field: keyof EditState; value: any };

const EDIT_INIT: EditState = {
  id: null,
  open: false,
  name: "",
  slug: "",
  description: "",
  autoSlug: false,
};

function editReducer(state: EditState, action: EditAction): EditState {
  switch (action.type) {
    case "open":
      return {
        id: action.tag.id,
        open: true,
        name: action.tag.name,
        slug: action.tag.slug,
        description: action.tag.description ?? "",
        autoSlug: false,
      };
    case "close":
      return { ...EDIT_INIT };
    case "set":
      return { ...state, [action.field]: action.value };
    default:
      return state;
  }
}

// ────────────────────────────────────────────────────────────
// Page component
// ────────────────────────────────────────────────────────────
export default function AdminTagsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { token, getAuthHeader } = useAuth();

  // auth guard
  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  // query state
  const [q, setQ] = useState(sp.get("q") || "");
  const [page, setPage] = useState<number>(Number(sp.get("page") || 1));
  const [limit, setLimit] = useState<number>(Number(sp.get("limit") || 30));
  const [order, setOrder] = useState<"ASC" | "DESC">(
    ((sp.get("order") || "ASC").toUpperCase() as any) || "ASC"
  );

  // list state
  const [items, setItems] = useState<Tag[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // create state
  const [cstate, cdispatch] = useReducer(createReducer, CREATE_INIT);
  const [creating, setCreating] = useState(false);

  // edit modal
  const [estate, edispatch] = useReducer(editReducer, EDIT_INIT);
  const [updating, setUpdating] = useState(false);

  // delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // slug checking
  const debouncedCreateSlug = useDebounced(cstate.slug, 400);
  const [createSlugStatus, setCreateSlugStatus] = useState<
    "idle" | "checking" | "ok" | "taken" | "invalid" | "error"
  >("idle");

  const debouncedEditSlug = useDebounced(estate.slug, 400);
  const [editSlugStatus, setEditSlugStatus] = useState<
    "idle" | "checking" | "ok" | "taken" | "invalid" | "error"
  >("idle");

  // sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("order", order);
    router.replace(`/tags?${params.toString()}`);
  }, [q, page, limit, order, router]);

  // debounced q
  const dq = useDebounced(q, 350);

  // fetch list
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const url = new URL(apiUrl("/tags"));
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("order", order);
        if (dq.trim()) url.searchParams.set("q", dq.trim());

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error(`Không tải được tags (${res.status})`);
        const data = (await res.json()) as ListResp;
        setItems(data.items || []);
        setTotal(data.total || 0);
      } catch (e: any) {
        setErr(e?.message ?? "Lỗi kết nối");
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [page, limit, order, dq]);

  // reset page khi q/limit/order đổi
  useEffect(() => {
    setPage(1);
  }, [dq, limit, order]);

  // auto slug (create)
  useEffect(() => {
    if (!cstate.autoSlug) return;
    const next = slugifySafe(cstate.name);
    if (next !== cstate.slug)
      cdispatch({ type: "set", field: "slug", value: next });
  }, [cstate.name, cstate.autoSlug]); // intentionally skip cstate.slug

  // auto slug (edit)
  useEffect(() => {
    if (!estate.open || !estate.autoSlug) return;
    const next = slugifySafe(estate.name);
    if (next !== estate.slug)
      edispatch({ type: "set", field: "slug", value: next });
  }, [estate.open, estate.name, estate.autoSlug]); // skip estate.slug

  // check slug (create)
  useEffect(() => {
    const s = debouncedCreateSlug.trim();
    if (!s) return setCreateSlugStatus("idle");
    if (!/^[a-z0-9-]+$/.test(s)) return setCreateSlugStatus("invalid");

    let cancel = false;
    (async () => {
      setCreateSlugStatus("checking");
      try {
        const res = await fetch(
          apiUrl(`/tags/slug-exists?slug=${encodeURIComponent(s)}`),
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancel)
          setCreateSlugStatus(Boolean(data?.exists) ? "taken" : "ok");
      } catch {
        if (!cancel) setCreateSlugStatus("error");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [debouncedCreateSlug]);

  // check slug (edit)
  useEffect(() => {
    const s = debouncedEditSlug.trim();
    if (!estate.open) return setEditSlugStatus("idle");
    if (!s) return setEditSlugStatus("idle");
    if (!/^[a-z0-9-]+$/.test(s)) return setEditSlugStatus("invalid");

    let cancel = false;
    (async () => {
      setEditSlugStatus("checking");
      try {
        const res = await fetch(
          apiUrl(`/tags/slug-exists?slug=${encodeURIComponent(s)}`),
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        // lưu ý: nếu slug mới trùng chính nó thì service trả exists=true,
        // nhưng backend khi PATCH sẽ bỏ qua nếu id trùng => ta hiển thị “ok” trừ khi user đổi sang slug người khác.
        if (!cancel) setEditSlugStatus(Boolean(data?.exists) ? "taken" : "ok");
      } catch {
        if (!cancel) setEditSlugStatus("error");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [debouncedEditSlug, estate.open]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / (limit || 30))),
    [total, limit]
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  // Create
  const creatingDisabled =
    !token ||
    !cstate.name.trim() ||
    !cstate.slug.trim() ||
    creating ||
    createSlugStatus === "checking" ||
    createSlugStatus === "taken" ||
    createSlugStatus === "invalid";

  async function handleCreate() {
    if (creatingDisabled) return;
    setCreating(true);
    try {
      const res = await fetch(apiUrl("/tags"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          name: cstate.name.trim(),
          slug: cstate.slug.trim(),
          description: cstate.description || undefined,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        alert(`Tạo tag thất bại: ${res.status} ${t}`);
        return;
      }
      cdispatch({ type: "reset" });
      // refetch
      const url = new URL(apiUrl("/tags"));
      url.searchParams.set("page", "1");
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("order", order);
      if (q.trim()) url.searchParams.set("q", q.trim());
      const listRes = await fetch(url.toString(), { cache: "no-store" });
      const data = (await listRes.json()) as ListResp;
      setItems(data.items || []);
      setTotal(data.total || 0);
      setPage(1);
    } catch (e: any) {
      alert(e?.message ?? "Lỗi kết nối");
    } finally {
      setCreating(false);
    }
  }

  // Edit
  const updatingDisabled =
    !token ||
    !estate.id ||
    !estate.name.trim() ||
    !estate.slug.trim() ||
    updating ||
    editSlugStatus === "checking" ||
    editSlugStatus === "invalid";

  async function handleOpenEdit(tag: Tag) {
    edispatch({ type: "open", tag });
  }

  async function handleUpdate() {
    if (updatingDisabled || !estate.id) return;
    setUpdating(true);
    try {
      const res = await fetch(apiUrl(`/tags/${estate.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          name: estate.name.trim(),
          slug: estate.slug.trim(),
          description: estate.description || undefined,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        alert(`Cập nhật tag thất bại: ${res.status} ${t}`);
        return;
      }
      // cập nhật item tại chỗ
      setItems((prev) =>
        prev.map((it) =>
          it.id === estate.id
            ? {
                ...it,
                name: estate.name.trim(),
                slug: estate.slug.trim(),
                description: estate.description || null,
              }
            : it
        )
      );
      edispatch({ type: "close" });
    } catch (e: any) {
      alert(e?.message ?? "Lỗi kết nối");
    } finally {
      setUpdating(false);
    }
  }

  // Delete
  async function handleDelete(id: string) {
    if (!confirm("Xoá tag này?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(apiUrl(`/tags/${id}`), {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) {
        const t = await res.text();
        alert(`Xoá tag thất bại: ${res.status} ${t}`);
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e: any) {
      alert(e?.message ?? "Lỗi kết nối");
    } finally {
      setDeletingId(null);
    }
  }

  // Slug feedback
  const createSlugHint =
    cstate.slug &&
    (createSlugStatus === "checking"
      ? "Đang kiểm tra slug…"
      : createSlugStatus === "ok"
        ? "Slug khả dụng"
        : createSlugStatus === "taken"
          ? "Slug đã tồn tại"
          : createSlugStatus === "invalid"
            ? "Slug không hợp lệ (a-z, 0-9, dấu -)"
            : createSlugStatus === "error"
              ? "Không kiểm tra được slug"
              : "");

  const editSlugHint =
    estate.open &&
    estate.slug &&
    (editSlugStatus === "checking"
      ? "Đang kiểm tra slug…"
      : editSlugStatus === "ok"
        ? "Slug khả dụng"
        : editSlugStatus === "taken"
          ? "Slug đã tồn tại (nếu trùng chính nó vẫn cập nhật được)"
          : editSlugStatus === "invalid"
            ? "Slug không hợp lệ (a-z, 0-9, dấu -)"
            : editSlugStatus === "error"
              ? "Không kiểm tra được slug"
              : "");

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tags</h1>
      </div>

      {/* Toolbar */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Tìm theo tên hoặc slug…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <label className="text-sm">Order</label>
          <select
            className="border rounded-lg px-2 py-2"
            value={order}
            onChange={(e) => setOrder(e.target.value as any)}
          >
            <option value="ASC">↑ ASC</option>
            <option value="DESC">↓ DESC</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Limit</label>
          <select
            className="border rounded-lg px-2 py-2"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-600 flex items-center">
          {loading
            ? "Đang tải…"
            : `Tổng: ${total} • Trang ${page}/${Math.max(1, totalPages)}`}
        </div>
      </section>

      {/* Create form */}
      <section className="grid gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="font-semibold">Tạo Tag</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Tên tag"
            value={cstate.name}
            onChange={(e) =>
              cdispatch({ type: "set", field: "name", value: e.target.value })
            }
          />
          <div className="flex items-center gap-2">
            <input
              className="border rounded-lg px-3 py-2 flex-1"
              placeholder="Slug"
              value={cstate.slug}
              onChange={(e) => {
                cdispatch({
                  type: "set",
                  field: "slug",
                  value: e.target.value,
                });
                cdispatch({ type: "set", field: "autoSlug", value: false });
              }}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cstate.autoSlug}
                onChange={(e) =>
                  cdispatch({
                    type: "set",
                    field: "autoSlug",
                    value: e.target.checked,
                  })
                }
              />
              Auto
            </label>
            <button
              className="border rounded-lg px-3 py-2"
              type="button"
              onClick={() =>
                cdispatch({
                  type: "set",
                  field: "slug",
                  value: slugifySafe(cstate.name),
                })
              }
            >
              Tạo slug
            </button>
          </div>
          {cstate.slug ? (
            <p
              className={clsx(
                "text-sm col-span-full",
                createSlugStatus === "taken" && "text-red-600",
                createSlugStatus === "invalid" && "text-red-600",
                createSlugStatus === "ok" && "text-green-600",
                createSlugStatus === "error" && "text-gray-600"
              )}
            >
              {createSlugHint}
            </p>
          ) : null}
          <textarea
            className="border rounded-lg px-3 py-2 md:col-span-2"
            placeholder="Mô tả (tuỳ chọn)"
            value={cstate.description}
            onChange={(e) =>
              cdispatch({
                type: "set",
                field: "description",
                value: e.target.value,
              })
            }
          />
        </div>
        <div>
          <button
            type="button"
            disabled={creatingDisabled}
            onClick={handleCreate}
            className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
          >
            {creating ? "Đang tạo…" : "Tạo tag"}
          </button>
        </div>
      </section>

      {/* List */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-2 w-10">#</th>
              <th className="px-4 py-2">Tên</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2">Mô tả</th>
              <th className="px-4 py-2 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-3" colSpan={5}>
                  Đang tải…
                </td>
              </tr>
            ) : err ? (
              <tr>
                <td className="px-4 py-3 text-red-600" colSpan={5}>
                  {err}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-3" colSpan={5}>
                  Không có tag.
                </td>
              </tr>
            ) : (
              items.map((t, i) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-3">{(page - 1) * limit + i + 1}</td>
                  <td className="px-4 py-3">{t.name}</td>
                  <td className="px-4 py-3 text-gray-600">/{t.slug}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {t.description || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => handleOpenEdit(t)}
                      >
                        Sửa
                      </button>
                      <button
                        className="text-red-600 hover:underline disabled:opacity-50"
                        onClick={() => handleDelete(t.id)}
                        disabled={deletingId === t.id}
                      >
                        {deletingId === t.id ? "Đang xoá…" : "Xoá"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Pagination */}
      <section className="flex items-center justify-center gap-2">
        <button
          onClick={() => setPage(1)}
          disabled={page <= 1}
          className="border rounded-lg px-3 py-2 disabled:opacity-50"
        >
          « Đầu
        </button>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="border rounded-lg px-3 py-2 disabled:opacity-50"
        >
          ← Trước
        </button>
        <span>
          Trang {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="border rounded-lg px-3 py-2 disabled:opacity-50"
        >
          Sau →
        </button>
        <button
          onClick={() => setPage(totalPages)}
          disabled={page >= totalPages}
          className="border rounded-lg px-3 py-2 disabled:opacity-50"
        >
          Cuối »
        </button>
      </section>

      {/* Edit Modal */}
      {estate.open && (
        <div
          className="fixed inset-0 bg-black/30 grid place-items-center p-4"
          onClick={() => edispatch({ type: "close" })}
        >
          <div
            className="bg-white rounded-xl p-4 w-[min(720px,96vw)] grid gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg">Sửa Tag</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="Tên tag"
                value={estate.name}
                onChange={(e) =>
                  edispatch({
                    type: "set",
                    field: "name",
                    value: e.target.value,
                  })
                }
              />
              <div className="flex items-center gap-2">
                <input
                  className="border rounded-lg px-3 py-2 flex-1"
                  placeholder="Slug"
                  value={estate.slug}
                  onChange={(e) => {
                    edispatch({
                      type: "set",
                      field: "slug",
                      value: e.target.value,
                    });
                    edispatch({ type: "set", field: "autoSlug", value: false });
                  }}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={estate.autoSlug}
                    onChange={(e) =>
                      edispatch({
                        type: "set",
                        field: "autoSlug",
                        value: e.target.checked,
                      })
                    }
                  />
                  Auto
                </label>
                <button
                  className="border rounded-lg px-3 py-2"
                  type="button"
                  onClick={() =>
                    edispatch({
                      type: "set",
                      field: "slug",
                      value: slugifySafe(estate.name),
                    })
                  }
                >
                  Tạo slug
                </button>
              </div>
              {estate.slug ? (
                <p
                  className={clsx(
                    "text-sm col-span-full",
                    editSlugStatus === "taken" && "text-red-600",
                    editSlugStatus === "invalid" && "text-red-600",
                    editSlugStatus === "ok" && "text-green-600",
                    editSlugStatus === "error" && "text-gray-600"
                  )}
                >
                  {editSlugHint}
                </p>
              ) : null}
              <textarea
                className="border rounded-lg px-3 py-2 md:col-span-2"
                placeholder="Mô tả"
                value={estate.description}
                onChange={(e) =>
                  edispatch({
                    type: "set",
                    field: "description",
                    value: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                className="px-3 py-2 rounded-lg border"
                onClick={() => edispatch({ type: "close" })}
                type="button"
              >
                Huỷ
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
                onClick={handleUpdate}
                disabled={updatingDisabled}
                type="button"
              >
                {updating ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
