"use client";

import { useEffect, useMemo, useState } from "react";

type Source = { id: string; name: string; base_url: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${text}`);
  }
  return (await res.json()) as T;
}

export default function SourcesPage() {
  // list & paging
  const [sources, setSources] = useState<Source[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const start = useMemo(() => page * pageSize, [page, pageSize]);
  const end = useMemo(() => start + pageSize, [start, pageSize]);

  // form create
  const [cName, setCName] = useState("");
  const [cBase, setCBase] = useState("");

  // inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eBase, setEBase] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const list = await api<Source[]>(
        `/v1/sources?limit=${pageSize}&offset=${start}${
          q ? `&q=${encodeURIComponent(q)}` : ""
        }`
      );
      setSources(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, start, pageSize]);

  async function createSource(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/v1/sources`, {
        method: "POST",
        body: JSON.stringify({ name: cName, base_url: cBase }),
      });
      setCName("");
      setCBase("");
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  function startEdit(s: Source) {
    setEditId(s.id);
    setEName(s.name);
    setEBase(s.base_url);
  }
  function cancelEdit() {
    setEditId(null);
    setEName("");
    setEBase("");
  }

  async function saveEdit(id: string) {
    try {
      await api(`/v1/sources/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: eName, base_url: eBase }),
      });
      cancelEdit();
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function deleteRow(id: string) {
    if (!confirm("Xoá nguồn này?")) return;
    try {
      await api(`/v1/sources/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Quản lý Sources</h1>

      {/* Create */}
      <form
        onSubmit={createSource}
        className="grid gap-3 rounded-2xl border p-4 shadow-sm"
      >
        <div className="grid gap-1">
          <label className="text-sm font-medium">Tên nguồn</label>
          <input
            value={cName}
            onChange={(e) => setCName(e.target.value)}
            className="rounded-md border px-3 py-2"
            placeholder="VD: Truyen QQ"
            required
          />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Base URL</label>
          <input
            value={cBase}
            onChange={(e) => setCBase(e.target.value)}
            className="rounded-md border px-3 py-2"
            placeholder="https://example.com"
            required
          />
        </div>
        <div>
          <button className="rounded-xl bg-black px-4 py-2 text-white">
            Tạo nguồn
          </button>
        </div>
      </form>

      {/* Search + paging */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => {
            setPage(0);
            setQ(e.target.value);
          }}
          placeholder="Tìm theo tên hoặc base_url…"
          className="w-80 rounded-md border px-3 py-2"
        />
        <button onClick={load} className="rounded-md border px-3 py-2">
          Tìm
        </button>

        <label className="text-sm ml-auto">
          Page size:&nbsp;
          <input
            type="number"
            min={10}
            step={10}
            value={pageSize}
            onChange={(e) => {
              const v = Math.max(10, Number(e.target.value) || 10);
              setPageSize(v);
              setPage(0);
            }}
            className="w-24 rounded-md border px-3 py-1"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border px-3 py-1"
          >
            ← Prev
          </button>
          <span className="text-sm">Page {page + 1}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border px-3 py-1"
          >
            Next →
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {/* Table */}
      <div className="overflow-auto rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Base URL</th>
              <th className="px-3 py-2">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 && (
              <tr>
                <td className="px-3 py-3 italic text-gray-500" colSpan={3}>
                  {loading ? "Loading..." : "Không có nguồn"}
                </td>
              </tr>
            )}
            {sources.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">
                  {editId === s.id ? (
                    <input
                      value={eName}
                      onChange={(e) => setEName(e.target.value)}
                      className="w-full rounded-md border px-2 py-1"
                    />
                  ) : (
                    s.name
                  )}
                </td>
                <td className="px-3 py-2">
                  {editId === s.id ? (
                    <input
                      value={eBase}
                      onChange={(e) => setEBase(e.target.value)}
                      className="w-full rounded-md border px-2 py-1"
                    />
                  ) : (
                    <a
                      href={s.base_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline"
                    >
                      {s.base_url}
                    </a>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editId === s.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(s.id)}
                        className="rounded-md border px-3 py-1"
                      >
                        Lưu
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-md border px-3 py-1"
                      >
                        Huỷ
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(s)}
                        className="rounded-md border px-3 py-1"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => deleteRow(s.id)}
                        className="rounded-md border px-3 py-1 text-red-700"
                      >
                        Xoá
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        API: <code>{API_BASE || "(relative)"}</code>
      </p>
    </div>
  );
}
