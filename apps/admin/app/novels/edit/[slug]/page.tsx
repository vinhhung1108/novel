// apps/admin/app/novels/edit/[slug]/page.tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ChangeEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Cropper from "react-easy-crop";
import { useAuth } from "@/components/AuthProvider";
import { apiUrl } from "@/lib/api";
import { fileToImage, cropToWebp } from "@/lib/crop";
import { slugifySafe } from "@/lib/slug";

const COVER_W = 600;
const COVER_H = 800;
const ASPECT = 3 / 4;
const CDN_BASE =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ?? "http://localhost:9000/novels";

type Novel = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_key: string | null;
  status: "ongoing" | "completed" | "hiatus" | string;
  source: string | null;
  source_url: string | null;
  author_id: string | null;
  rating_avg: number;
  rating_count: number;
  words_count: string;
  views: string;
  published_at: string | null;
  updated_at: string;

  original_title: string | null;
  alt_titles: string[] | null;
  language_code: string | null;
  is_featured: boolean;
  mature: boolean;
  priority: number;
};

type Author = { id: string; name: string };

type FormState = {
  title: string;
  slug: string;
  description: string;

  originalTitle: string;
  altTitles: string; // textarea (mỗi dòng 1 tên)
  languageCode: string;
  isFeatured: boolean;
  mature: boolean;
  priority: number;

  authorId: string;
};

type FormAction =
  | { type: "set"; field: keyof FormState; value: any }
  | { type: "setMany"; values: Partial<FormState> };

type UpdateNovelPayload = {
  title: string;
  slug: string;
  description: string;
  cover_image_key: string | null;
  original_title: string | null;
  alt_titles: string[];
  language_code: string | null;
  is_featured: boolean;
  mature: boolean;
  priority: number;
  author_id: string | null;
};

type CropArea = { x: number; y: number; width: number; height: number };
type SlugStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid"
  | "error";

const CARD_CLASS = "grid gap-3 bg-white border border-gray-200 rounded-xl p-4";

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "setMany":
      return { ...state, ...action.values };
    default:
      return state;
  }
}

export default function AdminEditNovelPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { token, getAuthHeader } = useAuth();

  const [loading, setLoading] = useState(true);
  const [novel, setNovel] = useState<Novel | null>(null);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [msg, setMsg] = useState("");

  const [form, dispatch] = useReducer(formReducer, {
    title: "",
    slug: "",
    description: "",

    originalTitle: "",
    altTitles: "",
    languageCode: "vi",
    isFeatured: false,
    mature: false,
    priority: 0,

    authorId: "",
  });

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
    resetCrop,
  } = useCoverWorkflow();

  // bảo vệ
  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  // load novel + authors (best-effort)
  useEffect(() => {
    (async () => {
      if (!slug) return;
      try {
        setLoading(true);
        setMsg("");

        // novel by slug
        const nres = await fetch(
          apiUrl(`/novels/${encodeURIComponent(slug)}`),
          {
            cache: "no-store",
          }
        );
        if (!nres.ok) {
          setMsg(`Không tải được truyện (${nres.status})`);
          setLoading(false);
          return;
        }
        const n = (await nres.json()) as Novel;
        setNovel(n);

        // seed form
        dispatch({
          type: "setMany",
          values: {
            title: n.title || "",
            slug: n.slug || "",
            description: n.description || "",
            originalTitle: n.original_title || "",
            altTitles: (n.alt_titles || []).join("\n"),
            languageCode: n.language_code || "vi",
            isFeatured: !!n.is_featured,
            mature: !!n.mature,
            priority: Number.isFinite(n.priority) ? n.priority : 0,
            authorId: n.author_id ?? "",
          },
        });
      } catch (e: any) {
        setMsg(e?.message ?? "Lỗi kết nối");
      } finally {
        setLoading(false);
      }

      // load authors (nếu có API /v1/authors)
      try {
        const ares = await fetch(apiUrl(`/authors?page=1&limit=500`), {
          cache: "no-store",
        });
        if (ares.ok) {
          const data = await ares.json();
          const items: Author[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.items)
              ? data.items
              : [];
          setAuthors(items);
        }
      } catch {
        // bỏ qua nếu chưa có API
      }
    })();
  }, [slug]);

  // kiểm tra slug
  const slugStatus = useSlugAvailability(form.slug, novel?.slug);

  const disabled = useMemo(() => {
    const hasBasics = form.title.trim() && form.slug.trim();
    const slugInvalid =
      slugStatus === "taken" ||
      slugStatus === "invalid" ||
      slugStatus === "checking";
    return !token || !hasBasics || slugInvalid;
  }, [form.title, form.slug, slugStatus, token]);

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

  // chọn file
  const onPickFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] || null;
      try {
        await pickFile(f);
        setMsg("");
      } catch (err: any) {
        setMsg(err?.message ?? "Không đọc được ảnh");
      } finally {
        e.target.value = "";
      }
    },
    [pickFile]
  );

  // crop complete
  const onCropComplete = useCallback(
    (_: unknown, area: CropArea) => {
      setCropArea({
        x: Math.max(0, Math.round(area.x)),
        y: Math.max(0, Math.round(area.y)),
        width: Math.max(1, Math.round(area.width)),
        height: Math.max(1, Math.round(area.height)),
      });
    },
    [setCropArea]
  );

  // convert sau crop
  const doConvert = useCallback(async () => {
    const b = await computeWebp();
    if (!b) {
      setMsg("Chưa chọn vùng crop");
      return;
    }
    setMsg("Đã crop & chuyển WebP ✓");
  }, [computeWebp]);

  // upload cover
  const [uploading, setUploading] = useState(false);
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
    } catch (err: any) {
      setMsg(err?.message ?? "Lỗi kết nối");
      return null;
    } finally {
      setUploading(false);
    }
  }, [coverBlob, getAuthHeader, setUploadedKey]);

  // submit cập nhật
  const [saving, setSaving] = useState(false);
  const onSave = useCallback(async () => {
    if (!novel || disabled) return;
    setSaving(true);
    setMsg("");

    try {
      let keyToUse = uploadedKey ?? novel.cover_image_key;
      if (coverBlob && !uploadedKey) {
        const k = await uploadCover();
        if (!k) return;
        keyToUse = k;
      }

      const payload = buildUpdatePayload(form, keyToUse ?? null);

      const res = await fetch(apiUrl(`/novels/${novel.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        setMsg(`Lỗi lưu: ${res.status} ${txt}`);
        return;
      }

      const updated = (await res.json()) as Novel;
      setNovel(updated);
      setMsg("Đã lưu ✓");
      // sync slug nếu đã đổi
      if (updated.slug !== slug) {
        router.replace(`/novels/edit/${encodeURIComponent(updated.slug)}`);
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  }, [
    novel,
    disabled,
    uploadedKey,
    coverBlob,
    form.title,
    form.slug,
    form.description,
    form.originalTitle,
    form.altTitles,
    form.languageCode,
    form.isFeatured,
    form.mature,
    form.priority,
    form.authorId,
    getAuthHeader,
    router,
    slug,
    uploadCover,
  ]);

  const canUpload = !!coverBlob && !uploading;
  const isErrorMessage =
    msg.startsWith("Lỗi") || msg.startsWith("Không") || msg.startsWith("Chưa");

  if (loading) {
    return <main className="p-6">Đang tải…</main>;
  }
  if (!novel) {
    return (
      <main className="p-6 text-red-600">
        Không tìm thấy truyện hoặc lỗi tải.
      </main>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sửa truyện</h1>
        <div className="flex items-center gap-3">
          <a
            className="px-3 py-2 border rounded-lg"
            href={`http://localhost:3000/truyen/${encodeURIComponent(
              novel.slug
            )}`}
            target="_blank"
            rel="noreferrer"
          >
            👁️ Xem web
          </a>
          <button
            onClick={() => router.push("/novels/list")}
            className="px-3 py-2 border rounded-lg"
          >
            ← Danh sách
          </button>
        </div>
      </div>

      {/* Cơ bản */}
      <section className={CARD_CLASS}>
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Tiêu đề"
          value={form.title}
          onChange={(e) =>
            dispatch({ type: "set", field: "title", value: e.target.value })
          }
        />

        <div className="flex items-center gap-3">
          <input
            className="border rounded-lg px-3 py-2 flex-1"
            placeholder="Slug"
            value={form.slug}
            onChange={(e) =>
              dispatch({ type: "set", field: "slug", value: e.target.value })
            }
          />
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

      {/* Mở rộng */}
      <section className={CARD_CLASS}>
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
            placeholder="Mã ngôn ngữ (vd: vi, en, ja)"
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
            placeholder="Tên thay thế (alt_titles) — mỗi dòng 1 tên"
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
            {/* Author (nếu có API) */}
            {authors.length > 0 && (
              <label className="flex items-center gap-2">
                Tác giả
                <select
                  className="border rounded-lg px-2 py-1"
                  value={form.authorId}
                  onChange={(e) =>
                    dispatch({
                      type: "set",
                      field: "authorId",
                      value: e.target.value,
                    })
                  }
                >
                  <option value="">— Không chọn —</option>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </section>

      {/* Cover */}
      <section className={CARD_CLASS}>
        <div className="flex items-center gap-4">
          <div className="w-40 h-[213px] bg-gray-100 rounded-lg grid place-items-center overflow-hidden">
            {novel.cover_image_key ? (
              <img
                src={`${CDN_BASE}/${novel.cover_image_key}`}
                alt="Cover hiện tại"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-gray-500 text-sm">Chưa có cover</span>
            )}
          </div>
          <input type="file" accept="image/*" onChange={onPickFile} />
          {image && (
            <button onClick={resetCrop} className="px-3 py-2 border rounded-lg">
              Xoá ảnh đã chọn
            </button>
          )}
        </div>

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
                onClick={doConvert}
                className="border rounded-lg px-3 py-2"
                type="button"
              >
                Cắt & Convert WebP
              </button>
              <button
                disabled={!canUpload}
                onClick={uploadCover}
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

      <div className="flex items-center gap-3">
        <button
          disabled={disabled || saving}
          onClick={onSave}
          className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
          type="button"
        >
          {saving ? "Đang lưu…" : "Lưu thay đổi"}
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

/* ------------------------ helpers/hooks ------------------------ */

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

  const resetCrop = useCallback(() => {
    setImage(null);
    setCropArea(null);
    setBlob(null);
    setPreview(null);
    setUploadedKey(null);
    setZoom(1);
  }, []);

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
    resetCrop,
  };
}

function useSlugAvailability(input: string, current?: string): SlugStatus {
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
    // Nếu không đổi slug so với bản hiện tại → xem như hợp lệ
    if (current && slug === current) {
      setStatus("available");
      return;
    }

    let cancelled = false;
    async function check() {
      setStatus("checking");
      try {
        let res = await fetch(
          apiUrl(`/novels/slug-exists/${encodeURIComponent(slug)}`),
          {
            cache: "no-store",
          }
        );
        if (res.status === 404) {
          res = await fetch(
            apiUrl(`/novels/slug-exists?slug=${encodeURIComponent(slug)}`),
            { cache: "no-store" }
          );
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
  }, [slug, current]);

  return status;
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
}

function buildUpdatePayload(
  form: FormState,
  coverKey: string | null
): UpdateNovelPayload {
  const altTitles = parseAltTitles(form.altTitles);
  const language = form.languageCode.trim();
  const original = form.originalTitle.trim();
  const priority = Number.isFinite(form.priority) ? Math.max(0, form.priority) : 0;

  return {
    title: form.title.trim(),
    slug: form.slug.trim(),
    description: form.description,
    cover_image_key: coverKey,
    original_title: original || null,
    alt_titles: altTitles,
    language_code: language ? language : null,
    is_featured: form.isFeatured,
    mature: form.mature,
    priority,
    author_id: form.authorId || null,
  };
}

function parseAltTitles(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
