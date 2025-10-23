"use client";

import * as React from "react";

/* UI kit – dùng đúng các file em đã có */
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* -----------------------------------------------------------
 * Types & helpers
 * ---------------------------------------------------------*/
type Source = {
  id: string;
  name: string;
  domain?: string | null;
  created_at?: string;
};

type UpsertPayload = {
  name: string;
  domain?: string | null;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") ||
  "http://localhost:4000";

/** wrapper fetch tới API backend */
async function api<T>(
  path: string,
  init?: RequestInit & { json?: any }
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  if (init?.json !== undefined) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/* -----------------------------------------------------------
 * Page
 * ---------------------------------------------------------*/
export default function SourcesPage() {
  const [items, setItems] = React.useState<Source[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Source | null>(null);

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.domain ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [items, query]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ items: Source[] }>("/v1/sources");
      setItems(data.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    // Lần đầu mount thì load
    load();
  }, []);

  function startEdit(s: Source) {
    setEditing(s);
    setEditOpen(true);
  }

  async function handleCreate(payload: UpsertPayload) {
    setPending(true);
    setError(null);
    try {
      const created = await api<Source>("/v1/sources", {
        method: "POST",
        json: payload,
      });
      setItems((prev) => [created, ...prev]);
      setCreateOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "Create failed");
    } finally {
      setPending(false);
    }
  }

  async function handleUpdate(id: string, payload: UpsertPayload) {
    setPending(true);
    setError(null);
    try {
      const updated = await api<Source>(`/v1/sources/${id}`, {
        method: "PATCH",
        json: payload,
      });
      setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
      setEditOpen(false);
      setEditing(null);
    } catch (e: any) {
      setError(e?.message ?? "Update failed");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Xoá source này?")) return;
    setPending(true);
    setError(null);
    try {
      await api<void>(`/v1/sources/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "Delete failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sources</h1>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, domain, id…"
            className="w-64"
          />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Tạo mới</Button>
            </DialogTrigger>
            <CreateOrEditDialog
              title="Tạo Source"
              pending={pending}
              onSubmit={handleCreate}
            />
          </Dialog>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between p-4">
          <div className="text-sm text-muted-foreground">
            {loading ? "Đang tải…" : `${filtered.length} nguồn`}
            {error ? (
              <span className="ml-2 text-destructive">• {error}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              Làm mới
            </Button>
          </div>
        </div>
        <Separator />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">ID</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead className="w-[160px]">Tạo lúc</TableHead>
                <TableHead className="w-[160px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm">
                    Đang tải dữ liệu…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm">
                    Không có dữ liệu
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="align-top">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="font-mono">
                              {s.id.slice(0, 8)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="font-mono text-xs">
                            {s.id}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="align-top font-medium">
                      {s.name}
                    </TableCell>
                    <TableCell className="align-top">
                      {s.domain ? (
                        <a
                          className="text-primary underline-offset-2 hover:underline"
                          href={`https://${s.domain}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {s.domain}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">
                      {s.created_at
                        ? new Date(s.created_at).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex gap-2">
                        <Dialog
                          open={editOpen && editing?.id === s.id}
                          onOpenChange={(o) => {
                            if (!o) setEditing(null);
                            setEditOpen(o);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEdit(s)}
                            >
                              Sửa
                            </Button>
                          </DialogTrigger>
                          <CreateOrEditDialog
                            title="Sửa Source"
                            defaultValues={{
                              name: s.name,
                              domain: s.domain ?? "",
                            }}
                            pending={pending}
                            onSubmit={(payload) => handleUpdate(s.id, payload)}
                          />
                        </Dialog>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={pending}
                          onClick={() => handleDelete(s.id)}
                        >
                          Xoá
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/* -----------------------------------------------------------
 * Create/Edit dialog (dùng chung)
 * ---------------------------------------------------------*/
function CreateOrEditDialog({
  title,
  defaultValues,
  pending,
  onSubmit,
}: {
  title: string;
  defaultValues?: { name?: string; domain?: string | null };
  pending?: boolean;
  onSubmit: (payload: UpsertPayload) => Promise<void> | void;
}) {
  const [name, setName] = React.useState(defaultValues?.name ?? "");
  const [domain, setDomain] = React.useState(defaultValues?.domain ?? "");
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    setName(defaultValues?.name ?? "");
    setDomain(defaultValues?.domain ?? "");
  }, [defaultValues?.name, defaultValues?.domain]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const payload: UpsertPayload = {
      name: name.trim(),
      domain: domain.trim() ? domain.trim() : null,
    };

    if (!payload.name) {
      setErr("Tên là bắt buộc.");
      return;
    }

    onSubmit(payload);
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Nhập thông tin cho nguồn crawl (ví dụ: name = “Truyện Chu Hay”, domain
          = “truyenchuhay.vn”).
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Tên *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên hiển thị…"
          />
        </div>

        <div>
          <Label htmlFor="domain">
            Domain{" "}
            <span className="text-muted-foreground">(không bắt buộc)</span>
          </Label>
          <Input
            id="domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="ví dụ: example.com"
          />
        </div>

        {err ? <p className="text-sm text-destructive">{err}</p> : null}

        <DialogFooter className="gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
