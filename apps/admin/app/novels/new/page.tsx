"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ChangeEvent,
} from "react";
import Cropper from "react-easy-crop";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { apiUrl } from "@/lib/api";
import { cropToWebp, fileToImage } from "@/lib/crop";
import { slugifySafe } from "@/lib/slug";

const COVER_W = 600;
const COVER_H = 800;
const ASPECT = 3 / 4;
const CARD_CLASS = "grid gap-3 bg-white border border-gray-200 rounded-xl p-4";
const CDN_BASE =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ?? "http://localhost:9000/novels";

/* =========================
   Types
========================= */

type Author = { id: string; name: string };
type Tag = { id: string; name: string };

type FormState = {
  title: string;
  slug: string;
  autoSlug: boolean;
  description: string;

  // extra
  originalTitle: string;
  altTitles: string;
  languageCode: string;
  isFeatured: boolean;
  mature: boolean;
  priority: number;

  // relations
  authorId: string | null;
  tagIds: string[]; // multi
};

type FormAction =
  | { type: "set"; field: keyof FormState; value: FormState[keyof FormState] }
  | { type: "setMany"; values: Partial<FormState> };

type CropArea = { x: number; y: number; width: number; height: number };
type SlugStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid"
  | "error";

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

/* =========================
   Page
========================= */

export default function AdminCreateNovelPage() {
  const router = useRouter();
  const { token, getAuthHeader } = useAuth();

  const [form, dispatch] = useReducer(formReducer, INITIAL_FORM);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  // bảo vệ login
  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  // auto-slug
  useEffect(() => {
    if (!form.autoSlug) return;
    const next = slugifySafe(form.title);
    if (next !== form.slug)
      dispatch({ type: "set", field: "slug", value: next });
  }, [form.title, form.autoSlug, form.slug]);

  // check slug
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
          text: "Slug không hợp lệ (a-z, 0-9, dấu -)",
          tone: "danger" as const,
        };
      case "error":
        return { text: "Không kiểm tra được slug", tone: "muted" as const };
      default:
        return { text: null, tone: "muted" as const };
    }
  }, [slugStatus]);

  /* --------- Authors & Tags --------- */

  const {
    q: authorQ,
    setQ: setAuthorQ,
    loading: loadingAuthors,
    options: authorOptions,
    reload: reloadAuthors,
  } = useRemoteOptions<Author>({
    endpoint: "/authors",
    labelKey: "name",
    minChars: 0,
  });

  const {
    q: tagQ,
    setQ: setTagQ,
    loading: loadingTags,
    options: tagOptions,
    reload: reloadTags,
    createOne: createTag,
  } = useRemoteOptions<Tag>({
    endpoint: "/tags",
    labelKey: "name",
    minChars: 0,
    createEndpoint: "/tags", // POST { name }
    getAuthHeader,
  });

  // lần đầu tải options
  useEffect(() => {
    reloadAuthors();
    reloadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------- File change / crop --------- */

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

  /* --------- Upload cover --------- */

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

  /* --------- Submit --------- */

  const handleSubmit = useCallback(async () => {
    if (disabled) return;

    setSubmitting(true);
    setMsg("");

    try {
      // upload cover nếu cần
      let keyToUse = uploadedKey;
      if (coverBlob && !keyToUse) {
        keyToUse = await uploadCover();
        if (!keyToUse) return;
      }

      // Tạo novel
      const payload: any = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description,
        cover_image_key: keyToUse ?? undefined,

        // extra fields (đã có cột trong DB)
        original_title: form.originalTitle.trim() || undefined,
        alt_titles: form.altTitles
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        language_code: form.languageCode.trim() || undefined,
        is_featured: form.isFeatured,
        mature: form.mature,
        priority: Number.isFinite(form.priority) ? form.priority : 0,

        // relations
        author_id: form.authorId ?? undefined,
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

      // Gắn tags (nếu backend có endpoint). Nếu 404 thì bỏ qua.
      if (form.tagIds.length > 0) {
        try {
          const attach = await fetch(apiUrl(`/novels/${novel.id}/tags`), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeader(),
            },
            body: JSON.stringify({ tag_ids: form.tagIds }),
          });
          // Nếu API chưa tồn tại — bỏ qua (đừng chặn user)
          if (!attach.ok && attach.status !== 404) {
            // soft-warning
            // eslint-disable-next-line no-console
            console.warn("Attach tags failed:", attach.status);
          }
        } catch {
          // ignore
        }
      }

      setMsg("Đã tạo truyện ✓");
      window.open(`http://localhost:3000/truyen/${novel.slug}`, "_blank");
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

  /* --------- UI --------- */

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-5">
      <h1 className="text-2xl font-semibold">Tạo truyện</h1>

      {/* Thông tin cơ bản */}
      <section className={CARD_CLASS}>
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Tiêu đề"
          value={form.title}
          onChange={(e) =>
            dispatch({ type: "set", field: "title", value: e.target.value })
          }
        />

        {/* Slug */}
        <div className="flex items-center gap-3">
          <input
            className="border rounded-lg px-3 py-2 flex-1"
            placeholder="Slug (auto từ tiêu đề nếu bật Auto)"
            value={form.slug}
            onChange={(e) => {
              dispatch({ type: "set", field: "slug", value: e.target.value });
              dispatch({ type: "set", field: "autoSlug", value: false });
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
            className={
              slugFeedback.tone === "danger"
                ? "text-sm text-red-600"
                : slugFeedback.tone === "positive"
                  ? "text-sm text-green-600"
                  : "text-sm text-gray-600"
            }
          >
            {slugFeedback.text}
          </p>
        ) : null}
      </section>

      {/* Tác giả & Tags (thể loại) */}
      <section className={CARD_CLASS}>
        {/* Tác giả (search + chọn) */}
        <div className="grid gap-2">
          <label className="text-sm text-gray-700">Tác giả</label>
          <div className="flex gap-2">
            <input
              className="border rounded-lg px-3 py-2 flex-1"
              placeholder="Tìm tác giả…"
              value={authorQ}
              onChange={(e) => setAuthorQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") reloadAuthors();
              }}
            />
            <button
              className="border rounded-lg px-3 py-2"
              type="button"
              onClick={reloadAuthors}
            >
              {loadingAuthors ? "Đang tìm…" : "Tải"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="border rounded-lg px-3 py-2 min-w-56"
              value={form.authorId ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "set",
                  field: "authorId",
                  value: e.target.value || null,
                })
              }
            >
              <option value="">— Không chọn —</option>
              {authorOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {form.authorId && (
              <button
                className="border rounded-lg px-3 py-2"
                type="button"
                onClick={() =>
                  dispatch({ type: "set", field: "authorId", value: null })
                }
              >
                Bỏ chọn
              </button>
            )}
          </div>
        </div>

        {/* Tags (thể loại) — multi select + tạo nhanh */}
        <div className="grid gap-2">
          <label className="text-sm text-gray-700">
            Thể loại / Tags (chọn nhiều)
          </label>

          <div className="flex gap-2">
            <input
              className="border rounded-lg px-3 py-2 flex-1"
              placeholder="Tìm tag…"
              value={tagQ}
              onChange={(e) => setTagQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") reloadTags();
              }}
            />
            <button
              className="border rounded-lg px-3 py-2"
              type="button"
              onClick={reloadTags}
            >
              {loadingTags ? "Đang tìm…" : "Tải"}
            </button>
            <button
              className="border rounded-lg px-3 py-2"
              type="button"
              onClick={async () => {
                const name = tagQ.trim();
                if (!name) return;
                const created = await createTag?.({ name });
                if (created) {
                  reloadTags();
                  // auto chọn tag mới
                  dispatch({
                    type: "set",
                    field: "tagIds",
                    value: Array.from(new Set([...form.tagIds, created.id])),
                  });
                }
              }}
            >
              ➕ Tạo tag
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              className="border rounded-lg px-3 py-2 min-w-56"
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                dispatch({
                  type: "set",
                  field: "tagIds",
                  value: Array.from(new Set([...form.tagIds, id])),
                });
                e.currentTarget.selectedIndex = 0;
              }}
            >
              <option value="">— Chọn thêm tag —</option>
              {tagOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            {/* đã chọn */}
            <div className="flex flex-wrap gap-2">
              {form.tagIds.map((id) => {
                const t = tagOptions.find((x) => x.id === id);
                const label = t?.name ?? id.slice(0, 6);
                return (
                  <span
                    key={id}
                    className="px-2 py-1 rounded-full bg-gray-100 border text-sm flex items-center gap-2"
                  >
                    {label}
                    <button
                      type="button"
                      className="text-gray-500 hover:text-red-600"
                      onClick={() =>
                        dispatch({
                          type: "set",
                          field: "tagIds",
                          value: form.tagIds.filter((x) => x !== id),
                        })
                      }
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Thông tin mở rộng */}
      <section className={CARD_CLASS}>
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
            placeholder="Mã ngôn ngữ (language_code) — ví dụ: vi, en, ja…"
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
          <div className="flex items-center gap-6">
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

      {/* Ảnh bìa & crop */}
      <section className={CARD_CLASS}>
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

      {/* Submit */}
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

/* =========================
   Hooks & helpers
========================= */

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

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
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
        const res = await fetch(
          apiUrl(`/novels/slug-exists?slug=${encodeURIComponent(slug)}`),
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Slug check failed");
        const data = await res.json();
        if (!cancelled)
          setStatus(Boolean(data?.exists) ? "taken" : "available");
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

/**
 * Tải danh sách options từ API (authors/tags), có tìm kiếm, debounce nhẹ.
 * - GET {endpoint}?q=...
 * - (optional) POST createEndpoint để tạo nhanh (tags)
 */
function useRemoteOptions<T extends { id: string }>({
  endpoint,
  labelKey,
  minChars = 0,
  getAuthHeader,
  createEndpoint,
}: {
  endpoint: string;
  labelKey: keyof T & string;
  minChars?: number;
  getAuthHeader?: () => Record<string, string>;
  createEndpoint?: string; // nếu có => cho phép tạo nhanh
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<T[]>([]);
  const qDebounced = useDebouncedValue(q, 300);

  const reload = useCallback(async () => {
    if (qDebounced.length < minChars && qDebounced.length !== 0) return;
    setLoading(true);
    try {
      const url = new URL(apiUrl(endpoint));
      if (qDebounced.trim()) url.searchParams.set("q", qDebounced.trim());
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        setOptions([]);
        return;
      }
      const data = await res.json();
      // API của bạn có thể trả mảng hoặc {items}
      const arr: T[] = Array.isArray(data) ? data : data.items || [];
      setOptions(Array.isArray(arr) ? arr : []);
    } finally {
      setLoading(false);
    }
  }, [endpoint, qDebounced, minChars]);

  const createOne = createEndpoint
    ? async (body: Record<string, any>): Promise<T | null> => {
        try {
          const res = await fetch(apiUrl(createEndpoint), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(getAuthHeader ? getAuthHeader() : {}),
            },
            body: JSON.stringify(body),
          });
          if (!res.ok) return null;
          return (await res.json()) as T;
        } catch {
          return null;
        }
      }
    : undefined;

  useEffect(() => {
    reload();
  }, [reload]);

  return { q, setQ, loading, options, reload, createOne };
}
