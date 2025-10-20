"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BasicInfoSection } from "@/components/novels/BasicInfoSection";
import { AdvancedPropsSection } from "@/components/novels/AdvancedPropsSection";
import { RelationsSection } from "@/components/novels/RelationsSection";
import { CoverCropperSection } from "@/components/novels/CoverCropperSection";
import { MessageBar } from "@/components/novels/MessageBar";
import { useCoverWorkflow } from "@/hooks/useCoverWorkflow";
import { useNovelForm, useSubmitDisabled } from "@/hooks/useNovelForm";
import { useSlugAvailability } from "@/hooks/useSlugAvailability";
import {
  buildUpdatePayload,
  normalizeCollection,
} from "@/app/lib/novels/helpers";
import type {
  Author,
  Category,
  Tag,
  NovelDetail,
} from "@/app/lib/novels/types";
import {
  fetchAuthors,
  fetchCategories,
  fetchTags,
  fetchNovelBySlug,
  updateNovel,
  saveRelations,
} from "@/services/novels";
import { apiUrl } from "@/app/lib/api";
import { CDN_BASE } from "@/app/lib/novels/constants";

const READER_BASE =
  process.env.NEXT_PUBLIC_READER_BASE ?? "http://localhost:3000";

export default function AdminEditNovelPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { token, getAuthHeader } = useAuth();
  const { form, dispatch } = useNovelForm();

  const [novel, setNovel] = useState<NovelDetail | null>(null);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const {
    image,
    pickFile,
    setCropArea,
    computeWebp,
    blob: coverBlob,
    preview: coverPreview,
    uploadedKey,
    setUploadedKey,
    zoom,
    setZoom,
    reset,
  } = useCoverWorkflow();

  const slugStatus = useSlugAvailability(form.slug, novel?.slug ?? "");
  const disabled = useSubmitDisabled({
    token,
    title: form.title,
    slug: form.slug,
    slugStatus,
    submitting: saving,
    uploading,
  });

  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [novelRes, authorsRes, categoriesRes, tagsRes] =
          await Promise.allSettled([
            fetchNovelBySlug(slug),
            fetchAuthors(),
            fetchCategories(),
            fetchTags(),
          ]);

        if (cancelled) return;

        if (novelRes.status !== "fulfilled") {
          setMsg("Không tải được truyện");
          setLoading(false);
          return;
        }

        const detail = novelRes.value;
        setNovel(detail);
        dispatch({
          type: "setMany",
          values: {
            title: detail.title ?? "",
            slug: detail.slug ?? "",
            autoSlug: false,
            description: detail.description ?? "",
            originalTitle: detail.original_title ?? "",
            altTitles: (detail.alt_titles ?? []).join("\n"),
            languageCode: detail.language_code ?? "vi",
            isFeatured: !!detail.is_featured,
            mature: !!detail.mature,
            priority:
              typeof detail.priority === "number"
                ? detail.priority
                : Number(detail.priority ?? 0),
            authorId: detail.author_id ?? "",
            categoryIds: detail.category_ids ?? [],
            tagIds: detail.tag_ids ?? [],
            status: detail.status ?? "ongoing",
            source: detail.source ?? "local",
            sourceUrl: detail.source_url ?? "",
            publishedAt: detail.published_at
              ? detail.published_at.slice(0, 10)
              : "",
          },
        });

        if (authorsRes.status === "fulfilled")
          setAuthors(normalizeCollection(authorsRes.value));
        if (categoriesRes.status === "fulfilled")
          setCategories(normalizeCollection(categoriesRes.value));
        if (tagsRes.status === "fulfilled")
          setTags(normalizeCollection(tagsRes.value));

        if (
          authorsRes.status === "rejected" ||
          categoriesRes.status === "rejected" ||
          tagsRes.status === "rejected"
        ) {
          setMsg((prev) =>
            prev || "Không tải được dữ liệu tham chiếu (tác giả/thể loại/tag)"
          );
        }
      } catch (error: any) {
        if (!cancelled) setMsg(error?.message ?? "Lỗi kết nối");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug, dispatch]);

  const onCropComplete = useCallback(
    (_: unknown, areaPixels: { x: number; y: number; width: number; height: number }) => {
      setCropArea({
        x: Math.max(0, Math.round(areaPixels.x)),
        y: Math.max(0, Math.round(areaPixels.y)),
        width: Math.max(1, Math.round(areaPixels.width)),
        height: Math.max(1, Math.round(areaPixels.height)),
      });
    },
    [setCropArea]
  );

  const doConvert = useCallback(async () => {
    const blob = await computeWebp();
    if (!blob) {
      setMsg("Chưa chọn vùng crop");
      return;
    }
    setMsg("Đã crop & chuyển WebP ✓");
  }, [computeWebp]);

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
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
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
      setMsg(error?.message ?? "Lỗi upload cover");
      return null;
    } finally {
      setUploading(false);
    }
  }, [coverBlob, getAuthHeader, setUploadedKey]);

  const onSave = useCallback(async () => {
    if (!novel || disabled) return;
    setSaving(true);
    setMsg("");
    try {
      let keyToUse = uploadedKey ?? novel.cover_image_key ?? null;
      if (coverBlob && !uploadedKey) {
        const key = await uploadCover();
        if (!key) return;
        keyToUse = key;
      }

      const payload = buildUpdatePayload(form, keyToUse);
      const updated = await updateNovel(novel.id, payload, getAuthHeader);

      try {
        await saveRelations(
          novel.id,
          form.categoryIds,
          form.tagIds,
          getAuthHeader
        );
      } catch {
        // quan hệ là best-effort
      }

      setMsg("Đã lưu ✓");
      setNovel((prev) =>
        prev
          ? {
              ...prev,
              ...updated,
              cover_image_key: keyToUse,
              category_ids: form.categoryIds,
              tag_ids: form.tagIds,
            }
          : {
              ...(updated as NovelDetail),
              category_ids: form.categoryIds,
              tag_ids: form.tagIds,
            }
      );

      if (updated.slug && updated.slug !== novel.slug) {
        router.replace(`/novels/edit/${encodeURIComponent(updated.slug)}`);
      }
    } catch (error: any) {
      setMsg(error?.message ?? "Lỗi lưu dữ liệu");
    } finally {
      setSaving(false);
    }
  }, [
    novel,
    disabled,
    uploadedKey,
    coverBlob,
    uploadCover,
    form,
    getAuthHeader,
    router,
  ]);

  const canUpload = Boolean(coverBlob) && !uploading;
  if (loading) return <main className="p-6">Đang tải…</main>;
  if (!novel)
    return (
      <main className="p-6 text-red-600">
        Không tìm thấy truyện hoặc lỗi tải dữ liệu.
      </main>
    );

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sửa truyện</h1>
        <div className="flex items-center gap-3">
          <a
            className="px-3 py-2 border rounded-lg"
            href={`${READER_BASE}/truyen/${encodeURIComponent(novel.slug)}`}
            target="_blank"
            rel="noreferrer"
          >
            👁️ Xem web
          </a>
          <button
            onClick={() => router.push("/novels/list")}
            className="px-3 py-2 border rounded-lg"
            type="button"
          >
            ← Danh sách
          </button>
        </div>
      </div>

      <BasicInfoSection
        title={form.title}
        slug={form.slug}
        autoSlug={form.autoSlug}
        setTitleAction={(value) =>
          dispatch({ type: "set", field: "title", value })
        }
        setSlugAction={(value) =>
          dispatch({ type: "set", field: "slug", value })
        }
        setAutoSlugAction={(value) =>
          dispatch({ type: "set", field: "autoSlug", value })
        }
        description={form.description}
        setDescriptionAction={(value) =>
          dispatch({ type: "set", field: "description", value })
        }
        slugStatus={slugStatus}
      />

      <AdvancedPropsSection
        originalTitle={form.originalTitle}
        setOriginalTitleAction={(value) =>
          dispatch({ type: "set", field: "originalTitle", value })
        }
        languageCode={form.languageCode}
        setLanguageCodeAction={(value) =>
          dispatch({ type: "set", field: "languageCode", value })
        }
        altTitles={form.altTitles}
        setAltTitlesAction={(value) =>
          dispatch({ type: "set", field: "altTitles", value })
        }
        isFeatured={form.isFeatured}
        setIsFeaturedAction={(value) =>
          dispatch({ type: "set", field: "isFeatured", value })
        }
        mature={form.mature}
        setMatureAction={(value) =>
          dispatch({ type: "set", field: "mature", value })
        }
        priority={form.priority}
        setPriorityAction={(value) =>
          dispatch({ type: "set", field: "priority", value })
        }
        status={form.status}
        setStatusAction={(value) =>
          dispatch({ type: "set", field: "status", value })
        }
        source={form.source}
        setSourceAction={(value) =>
          dispatch({ type: "set", field: "source", value })
        }
        sourceUrl={form.sourceUrl}
        setSourceUrlAction={(value) =>
          dispatch({ type: "set", field: "sourceUrl", value })
        }
        publishedAt={form.publishedAt}
        setPublishedAtAction={(value) =>
          dispatch({ type: "set", field: "publishedAt", value })
        }
      />

      <RelationsSection
        authors={authors}
        categories={categories}
        tags={tags}
        authorId={form.authorId}
        setAuthorIdAction={(value) =>
          dispatch({ type: "set", field: "authorId", value })
        }
        categoryIds={form.categoryIds}
        toggleCategoryAction={(id) =>
          dispatch({ type: "toggleArr", field: "categoryIds", value: id })
        }
        tagIds={form.tagIds}
        toggleTagAction={(id) =>
          dispatch({ type: "toggleArr", field: "tagIds", value: id })
        }
      />

      <section className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-4">
          <div className="w-40 h-[213px] overflow-hidden rounded-lg border bg-gray-100">
            {novel.cover_image_key ? (
              <img
                src={`${CDN_BASE}/${novel.cover_image_key}`}
                alt="Cover hiện tại"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="grid h-full place-items-center text-sm text-gray-500">
                Chưa có cover
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Cập nhật ảnh bìa</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void pickFile(file);
                event.target.value = "";
              }}
            />
            {image && (
              <button
                onClick={() => reset()}
                className="self-start rounded-lg border px-3 py-2"
                type="button"
              >
                Bỏ ảnh đã chọn
              </button>
            )}
          </div>
        </div>

        {image && (
          <CoverCropperSection
            image={image}
            zoom={zoom}
            setZoom={setZoom}
            onCropComplete={onCropComplete}
            pickFile={(file) => void pickFile(file)}
            doConvert={doConvert}
            canUpload={canUpload}
            uploadCover={uploadCover}
            uploading={uploading}
            coverPreview={coverPreview}
            uploadedKey={uploadedKey}
            showPicker={false}
          />
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          disabled={disabled || saving}
          onClick={() => void onSave()}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
          type="button"
        >
          {saving ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
        <MessageBar msg={msg} />
      </div>
    </main>
  );
}
