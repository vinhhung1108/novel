"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Cropper from "react-easy-crop";
import { useAuth } from "@/components/AuthProvider";
import { apiUrl } from "@/lib/api";
import { cropToWebp, fileToImage } from "@/lib/crop";
import { slugifySafe } from "@/lib/slug";

const CDN_BASE =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ?? "http://localhost:9000/novels";

const COVER_W = 600;
const COVER_H = 800;
const ASPECT = 3 / 4;

type FormState = {
  title: string;
  slug: string;
  autoSlug: boolean;
  description: string;

  // extra
  originalTitle: string;
  altTitles: string; // textarea, mỗi dòng 1 tên
  languageCode: string;
  isFeatured: boolean;
  mature: boolean;
  priority: number;

  // relations
  authorId: string | null;
  categoryIds: string[]; // nhiều thể loại
  tagIds: string[]; // nhiều tag
};

type FormAction =
  | {
      type: "set";
      field: keyof FormState;
      value: FormState[keyof FormState];
    }
  | { type: "setMany"; values: Partial<FormState> };

type CropArea = { x: number; y: number; width: number; height: number };
type SlugStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid"
  | "error";

type Option = { id: string; name: string };

const INITIAL_FORM: FormState = {
  title: "",
  slug: "",
  autoSlug: true,
  description: "",

  originalTitle: "",
  altTitles: "",
  languageCode: "vi",
  isFeatured: false,
  mature: false,
  priority: 0,

  authorId: null,
  categoryIds: [],
  tagIds: [],
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value } as FormState;
    case "setMany":
      return { ...state, ...action.values };
    default:
      return state;
  }
}

export default function AdminCreateNovelPage() {
  const router = useRouter();
  const { token, getAuthHeader } = useAuth();

  const [form, dispatch] = useReducer(formReducer, INITIAL_FORM);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cover workflow
  const {
    image,
    pickFile,
    zoom,
    setZoom,
    setCropArea,
    computeWebp,
    blob: coverBlob,
    preview: coverPreview,
    uploadedKey,
    setUploadedKey,
  } = useCoverWorkflow();

  // Bảo vệ
  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  // Auto slug theo title
  useEffect(() => {
    if (!form.autoSlug) return;
    const next = slugifySafe(form.title);
    if (next !== form.slug) {
      dispatch({ type: "set", field: "slug", value: next });
    }
  }, [form.title, form.autoSlug, form.slug]);

  // Kiểm tra slug trùng
  const slugStatus = useSlugAvailability(form.slug);

  const disabled = useMemo(() => {
    const hasBasics = form.title.trim() && form.slug.trim();
    const slugInvalid = slugStatus === "taken" || slugStatus === "invalid";
    return (
      !token ||
      !hasBasics ||
      slugInvalid ||
      submitting ||
      uploading ||
      slugStatus === "checking"
    );
  }, [form.title, form.slug, slugStatus, submitting, uploading, token]);

  const slugFeedback = useMemo(() => {
    switch (slugStatus) {
      case "checking":
        return { text: "Đang kiểm tra slug…", tone: "muted" as const };
      case "available":
        return { text: "Slug khả dụng", tone: "positive" as const };
      case "taken":
        return { text: "Slug đã tồn tại", tone: "danger" as const };
      case "invalid":
        return {
          text: "Slug không hợp lệ (chỉ gồm a-z, 0-9 và dấu gạch ngang)",
          tone: "danger" as const,
        };
      case "error":
        return { text: "Không kiểm tra được slug", tone: "muted" as const };
      default:
        return { text: null, tone: "muted" as const };
    }
  }, [slugStatus]);

  // Dữ liệu liên quan
  const authors = useOptions("/authors");
  const categories = useOptions("/categories");
  const tags = useOptions("/tags");

  // Chọn ảnh
  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      try {
        const file = event.target.files?.[0] ?? null;
        await pickFile(file);
        setMsg("");
      } catch (error: any) {
        setMsg(error?.message ?? "Không đọc được ảnh");
      } finally {
        event.target.value = "";
      }
    },
    [pickFile]
  );

  // Crop complete
  const onCropComplete = useCallback(
    (_: unknown, areaPixels: CropArea) => {
      setCropArea({
        x: Math.max(0, Math.round(areaPixels.x)),
        y: Math.max(0, Math.round(areaPixels.y)),
        width: Math.max(1, Math.round(areaPixels.width)),
        height: Math.max(1, Math.round(areaPixels.height)),
      });
    },
    [setCropArea]
  );

  // Convert ảnh sang webp
  const handleConvert = useCallback(async () => {
    if (!image) {
      setMsg("Chưa chọn ảnh");
      return;
    }
    const blob = await computeWebp();
    if (!blob) {
      setMsg("Chưa chọn vùng crop");
      return;
    }
    setMsg("Đã crop & chuyển WebP ✓");
  }, [computeWebp, image]);

  // Upload cover
  const uploadCover = useCallback(async (): Promise<string | null> => {
    if (!coverBlob) {
      setMsg("Chưa có ảnh WebP để upload");
      return null;
    }

    setUploading(true);
    setMsg("");
    try {
      const presignRes = await fetch(apiUrl("/upload/presign"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ ext: "webp", contentType: "image/webp" }),
        cache: "no-store",
      });

      if (!presignRes.ok) {
        const text = await presignRes.text();
        setMsg(`Không lấy được URL ký sẵn: ${presignRes.status} ${text}`);
        return null;
      }

      const { url, key } = await presignRes.json();
      const putRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "image/webp" },
        body: coverBlob,
      });

      if (!putRes.ok) {
        setMsg(`Upload cover thất bại: ${putRes.status}`);
        return null;
      }

      setMsg("Đã upload cover ✓");
      setUploadedKey(key);
      return key as string;
    } catch (error: any) {
      setMsg(error?.message ?? "Lỗi kết nối");
      return null;
    } finally {
      setUploading(false);
    }
  }, [coverBlob, getAuthHeader, setUploadedKey]);

  // Submit tạo truyện
  const handleSubmit = useCallback(async () => {
    if (disabled) return;

    setSubmitting(true);
    setMsg("");

    try {
      let keyToUse = uploadedKey;
      if (coverBlob && !keyToUse) {
        keyToUse = await uploadCover();
        if (!keyToUse) return;
      }

      const payload: any = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description,
        cover_image_key: keyToUse ?? undefined,
        author_id: form.authorId ?? undefined,

        // extra
        original_title: form.originalTitle.trim() || undefined,
        alt_titles: form.altTitles
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        language_code: form.languageCode.trim() || undefined,
        is_featured: form.isFeatured,
        mature: form.mature,
        priority: Number.isFinite(form.priority) ? form.priority : 0,
      };

      const res = await fetch(apiUrl("/novels"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        setMsg(`Lỗi tạo truyện: ${res.status} ${text}`);
        return;
      }

      const novel = await res.json();

      // Gắn categories
      if (form.categoryIds.length > 0) {
        try {
          const r = await fetch(apiUrl(`/novels/${novel.id}/categories`), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeader(),
            },
            body: JSON.stringify({ category_ids: form.categoryIds }),
          });
          if (!r.ok && r.status !== 404) {
            console.warn("Attach categories failed:", r.status);
          }
        } catch {}
      }

      // Gắn tags
      if (form.tagIds.length > 0) {
        try {
          const r = await fetch(apiUrl(`/novels/${novel.id}/tags`), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeader(),
            },
            body: JSON.stringify({ tag_ids: form.tagIds }),
          });
          if (!r.ok && r.status !== 404) {
            console.warn("Attach tags failed:", r.status);
          }
        } catch {}
      }

      setMsg("Đã tạo truyện ✓");
      // mở web xem
      window.open(`http://localhost:3000/truyen/${novel.slug}`, "_blank");
      // quay về danh sách
      router.replace("/novels/list");
    } catch (error: any) {
      setMsg(error?.message ?? "Lỗi kết nối");
    } finally {
      setSubmitting(false);
    }
  }, [
    coverBlob,
    disabled,
    form.altTitles,
    form.authorId,
    form.categoryIds,
    form.description,
    form.languageCode,
    form.mature,
    form.originalTitle,
    form.priority,
    form.slug,
    form.tagIds,
    form.title,
    form.isFeatured,
    getAuthHeader,
    router,
    uploadCover,
    uploadedKey,
  ]);

  const canUpload = !!coverBlob && !uploading;
  const isErrorMessage =
    msg.startsWith("Lỗi") || msg.startsWith("Không") || msg.startsWith("Chưa");

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">➕ Tạo truyện mới</h1>
        <Link
          href="/novels/list"
          className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          ← Quay lại danh sách
        </Link>
      </div>

      {/* Cơ bản */}
      <section className="grid gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Tiêu đề"
          value={form.title}
          onChange={(e) =>
            dispatch({ type: "set", field: "title", value: e.target.value })
          }
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <input
              className="border rounded-lg px-3 py-2 flex-1"
              placeholder="Slug (auto từ tiêu đề nếu bật Auto)"
              value={form.slug}
              onChange={(e) => {
                dispatch({ type: "set", field: "slug", value: e.target.value });
                dispatch({
                  type: "set",
                  field: "autoSlug",
                  value: false,
                });
              }}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.autoSlug}
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
              onClick={() =>
                dispatch({
                  type: "set",
                  field: "slug",
                  value: slugifySafe(form.title),
                })
              }
              className="border rounded-lg px-3 py-2"
              type="button"
            >
              Tạo từ tiêu đề
            </button>
          </div>

          {form.slug && slugFeedback.text ? (
            <p
              className={clsx(
                "text-sm",
                slugFeedback.tone === "danger" && "text-red-600",
                slugFeedback.tone === "positive" && "text-green-600",
                slugFeedback.tone === "muted" && "text-gray-600"
              )}
            >
              {slugFeedback.text}
            </p>
          ) : null}
        </div>

        <textarea
          className="border rounded-lg px-3 py-2 min-h-32"
          placeholder="Mô tả"
          value={form.description}
          onChange={(e) =>
            dispatch({
              type: "set",
              field: "description",
              value: e.target.value,
            })
          }
        />
      </section>

      {/* Liên quan: Tác giả / Thể loại / Tags */}
      <section className="grid gap-4 bg-white border border-gray-200 rounded-xl p-4">
        {/* Author */}
        <div className="grid gap-2">
          <div className="font-medium">Tác giả</div>
          <SearchSelect
            placeholder="Tìm tác giả…"
            items={authors.items}
            loading={authors.loading}
            q={authors.q}
            setQ={authors.setQ}
            value={form.authorId}
            onChange={(v) =>
              dispatch({ type: "set", field: "authorId", value: v })
            }
            allowNone
            footer={
              <CreateInline
                label="Tạo tác giả"
                onCreate={async (name) => {
                  const ok = await authors.createOne(name);
                  if (ok) {
                    // reload & gán authorId theo tên vừa tạo
                    await authors.reload();
                    const found = authors.items.find((a) => a.name === name);
                    if (found) {
                      dispatch({
                        type: "set",
                        field: "authorId",
                        value: found.id,
                      });
                    }
                  }
                }}
              />
            }
          />
        </div>

        {/* Categories */}
        <div className="grid gap-2">
          <div className="font-medium">Thể loại (nhiều)</div>
          <MultiPick
            placeholder="Tìm thể loại…"
            items={categories.items}
            loading={categories.loading}
            q={categories.q}
            setQ={categories.setQ}
            selected={form.categoryIds}
            onToggle={(id) => {
              const set = new Set(form.categoryIds);
              if (set.has(id)) set.delete(id);
              else set.add(id);
              dispatch({ type: "set", field: "categoryIds", value: [...set] });
            }}
            footer={
              <CreateInline
                label="Tạo thể loại"
                onCreate={async (name) => {
                  const ok = await categories.createOne(name);
                  if (ok) {
                    await categories.reload();
                    const found = categories.items.find((c) => c.name === name);
                    if (found) {
                      dispatch({
                        type: "set",
                        field: "categoryIds",
                        value: Array.from(
                          new Set([...form.categoryIds, found.id])
                        ),
                      });
                    }
                  }
                }}
              />
            }
          />
        </div>

        {/* Tags */}
        <div className="grid gap-2">
          <div className="font-medium">Tags (nhiều)</div>
          <MultiPick
            placeholder="Tìm tag…"
            items={tags.items}
            loading={tags.loading}
            q={tags.q}
            setQ={tags.setQ}
            selected={form.tagIds}
            onToggle={(id) => {
              const set = new Set(form.tagIds);
              if (set.has(id)) set.delete(id);
              else set.add(id);
              dispatch({ type: "set", field: "tagIds", value: [...set] });
            }}
            footer={
              <CreateInline
                label="Tạo tag"
                onCreate={async (name) => {
                  const ok = await tags.createOne(name);
                  if (ok) {
                    await tags.reload();
                    const found = tags.items.find((t) => t.name === name);
                    if (found) {
                      dispatch({
                        type: "set",
                        field: "tagIds",
                        value: Array.from(new Set([...form.tagIds, found.id])),
                      });
                    }
                  }
                }}
              />
            }
          />
        </div>
      </section>

      {/* Extra fields */}
      <section className="grid gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid md:grid-cols-2 gap-3">
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Tên gốc (original_title)"
            value={form.originalTitle}
            onChange={(e) =>
              dispatch({
                type: "set",
                field: "originalTitle",
                value: e.target.value,
              })
            }
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Mã ngôn ngữ (language_code), ví dụ: vi, en, ja…"
            value={form.languageCode}
            onChange={(e) =>
              dispatch({
                type: "set",
                field: "languageCode",
                value: e.target.value,
              })
            }
          />
          <textarea
            className="border rounded-lg px-3 py-2 col-span-full min-h-24"
            placeholder={"Tên thay thế (alt_titles)\nMỗi dòng 1 tên"}
            value={form.altTitles}
            onChange={(e) =>
              dispatch({
                type: "set",
                field: "altTitles",
                value: e.target.value,
              })
            }
          />
          <div className="flex items-center gap-6 col-span-full">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    field: "isFeatured",
                    value: e.target.checked,
                  })
                }
              />
              Featured
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.mature}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    field: "mature",
                    value: e.target.checked,
                  })
                }
              />
              Mature
            </label>
            <label className="flex items-center gap-2">
              Priority
              <input
                type="number"
                className="border rounded-lg px-2 py-1 w-24"
                value={form.priority}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  dispatch({
                    type: "set",
                    field: "priority",
                    value: Number.isFinite(next) ? next : 0,
                  });
                }}
              />
            </label>
          </div>
        </div>
      </section>

      {/* Ảnh bìa */}
      <section className="grid gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <input type="file" accept="image/*" onChange={handleFileChange} />
        {image && (
          <div className="grid gap-3">
            <div className="relative w-[600px] h-[400px] bg-black rounded-xl overflow-hidden">
              <Cropper
                image={image.src}
                crop={{ x: 0, y: 0 }}
                zoom={zoom}
                aspect={ASPECT}
                onZoomChange={setZoom}
                onCropChange={() => {}}
                onCropComplete={onCropComplete}
                objectFit="contain"
                restrictPosition={false}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-64"
              />
              <button
                onClick={handleConvert}
                className="border rounded-lg px-3 py-2"
                type="button"
              >
                Cắt & Convert WebP
              </button>
              <button
                disabled={!canUpload}
                onClick={async () => {
                  await uploadCover();
                }}
                className="border rounded-lg px-3 py-2 disabled:opacity-50"
                type="button"
              >
                {uploading ? "Đang upload..." : "Upload cover"}
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-40 h-[213px] bg-gray-100 rounded-lg grid place-items-center overflow-hidden">
                {coverPreview ? (
                  <img
                    src={coverPreview}
                    alt="Preview (WebP)"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-500 text-sm">Preview WebP</span>
                )}
              </div>
              {uploadedKey && (
                <div className="w-40 h-[213px] bg-gray-100 rounded-lg grid place-items-center overflow-hidden">
                  <img
                    src={`${CDN_BASE}/${uploadedKey}`}
                    alt="Đã upload"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          disabled={disabled}
          onClick={handleSubmit}
          className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
          type="button"
        >
          {submitting ? "Đang tạo…" : "Tạo truyện"}
        </button>
        {msg && (
          <span className={isErrorMessage ? "text-red-600" : "text-green-600"}>
            {msg}
          </span>
        )}
      </div>
    </main>
  );
}

/* ============================
   Hooks & mini components
============================ */

function useCoverWorkflow() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [zoom, setZoom] = useState(1);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);

  const pickFile = useCallback(async (file: File | null) => {
    setBlob(null);
    setPreview(null);
    setUploadedKey(null);
    if (!file) {
      setImage(null);
      setCropArea(null);
      setZoom(1);
      return;
    }
    const img = await fileToImage(file);
    setImage(img);
    setCropArea(null);
    setZoom(1);
  }, []);

  const computeWebp = useCallback(async () => {
    if (!image || !cropArea) return null;
    const { blob: nextBlob, dataUrl } = await cropToWebp(
      image,
      cropArea,
      COVER_W,
      COVER_H,
      0.86
    );
    setBlob(nextBlob);
    setPreview(dataUrl);
    return nextBlob;
  }, [cropArea, image]);

  return {
    image,
    pickFile,
    zoom,
    setZoom,
    setCropArea,
    computeWebp,
    blob,
    preview,
    uploadedKey,
    setUploadedKey,
  };
}

function useSlugAvailability(input: string): SlugStatus {
  const [status, setStatus] = useState<SlugStatus>("idle");
  const slug = useDebouncedValue(input.trim(), 350);

  useEffect(() => {
    if (!slug) {
      setStatus("idle");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setStatus("invalid");
      return;
    }

    let cancelled = false;
    async function check() {
      setStatus("checking");
      try {
        // ưu tiên /novels/slug-exists?slug=...
        let res = await fetch(
          apiUrl(`/novels/slug-exists?slug=${encodeURIComponent(slug)}`),
          { cache: "no-store" }
        );
        // nếu API cũ dạng /slug-exists/:slug, fallback
        if (res.status === 404) {
          res = await fetch(apiUrl(`/novels/slug-exists/${slug}`), {
            cache: "no-store",
          });
        }
        if (!res.ok) throw new Error("Slug check failed");
        const data = await res.json();
        if (!cancelled) {
          setStatus(Boolean(data?.exists) ? "taken" : "available");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return status;
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Tải danh sách options (authors/categories/tags) với tìm kiếm & tạo nhanh */
function useOptions(endpoint: "/authors" | "/categories" | "/tags") {
  const { getAuthHeader } = useAuth();
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 300);

  const [items, setItems] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const url = new URL(apiUrl(endpoint));
        if (qDebounced.trim()) url.searchParams.set("q", qDebounced.trim());
        const res = await fetch(url.toString(), { cache: "no-store", signal });
        if (!res.ok) throw new Error(`load ${endpoint} failed`);
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.items || [];
        const mapped: Option[] = list.map((x: any) => ({
          id: x.id,
          name: x.name,
        }));
        setItems(mapped);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("load options error", endpoint, e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [endpoint, qDebounced]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchList(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchList]);

  const createOne = useCallback(
    async (name: string) => {
      try {
        const res = await fetch(apiUrl(endpoint), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ name, slug: slugifySafe(name) }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [endpoint, getAuthHeader]
  );

  const reload = useCallback(async () => {
    await fetchList();
  }, [fetchList]);

  return { q, setQ, items, loading, reload, createOne };
}

/* ---------- UI tiny pieces ---------- */

function SearchSelect(props: {
  placeholder?: string;
  items: Option[];
  loading: boolean;
  q: string;
  setQ: (s: string) => void;
  value: string | null;
  onChange: (v: string | null) => void;
  allowNone?: boolean;
  footer?: React.ReactNode;
}) {
  const {
    placeholder,
    items,
    loading,
    q,
    setQ,
    value,
    onChange,
    allowNone,
    footer,
  } = props;
  return (
    <div className="grid gap-2">
      <input
        className="border rounded-lg px-3 py-2"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-56 overflow-auto border rounded-lg">
        {loading ? (
          <div className="p-3 text-sm text-gray-600">Đang tải…</div>
        ) : (
          <ul className="divide-y">
            {allowNone && (
              <li
                className={clsx(
                  "p-2 cursor-pointer hover:bg-gray-50",
                  value === null && "bg-gray-100"
                )}
                onClick={() => onChange(null)}
              >
                (Không chọn)
              </li>
            )}
            {items.length === 0 ? (
              <li className="p-2 text-sm text-gray-600">Không có dữ liệu</li>
            ) : (
              items.map((opt) => (
                <li
                  key={opt.id}
                  className={clsx(
                    "p-2 cursor-pointer hover:bg-gray-50",
                    value === opt.id && "bg-gray-100"
                  )}
                  onClick={() => onChange(opt.id)}
                >
                  {opt.name}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {footer ? <div className="pt-2">{footer}</div> : null}
    </div>
  );
}

function MultiPick(props: {
  placeholder?: string;
  items: Option[];
  loading: boolean;
  q: string;
  setQ: (s: string) => void;
  selected: string[];
  onToggle: (id: string) => void;
  footer?: React.ReactNode;
}) {
  const { placeholder, items, loading, q, setQ, selected, onToggle, footer } =
    props;
  return (
    <div className="grid gap-2">
      <input
        className="border rounded-lg px-3 py-2"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-56 overflow-auto border rounded-lg">
        {loading ? (
          <div className="p-3 text-sm text-gray-600">Đang tải…</div>
        ) : items.length === 0 ? (
          <div className="p-3 text-sm text-gray-600">Không có dữ liệu</div>
        ) : (
          <ul className="divide-y">
            {items.map((opt) => {
              const checked = selected.includes(opt.id);
              return (
                <li key={opt.id} className="p-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(opt.id)}
                  />
                  <span>{opt.name}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {footer ? <div className="pt-2">{footer}</div> : null}
    </div>
  );
}

function CreateInline(props: {
  label: string;
  onCreate: (name: string) => Promise<boolean>;
}) {
  const { label, onCreate } = props;
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input
        className="border rounded-lg px-3 py-2"
        placeholder={`${label} (nhanh)`}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-50"
        disabled={!name.trim() || busy}
        onClick={async () => {
          setBusy(true);
          const ok = await onCreate(name.trim());
          setBusy(false);
          if (ok) setName("");
        }}
      >
        {busy ? "Đang tạo…" : label}
      </button>
    </div>
  );
}
