"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  buildCreatePayload,
  normalizeCollection,
} from "@/app/lib/novels/helpers";
import type {
  Author,
  Category,
  Tag,
  CropArea,
} from "@/app/lib/novels/types";
import {
  fetchAuthors,
  fetchCategories,
  fetchTags,
  createNovel,
  saveRelations,
} from "@/services/novels";
import { apiUrl } from "@/app/lib/api";

const READER_BASE =
  process.env.NEXT_PUBLIC_READER_BASE ?? "http://localhost:3000";

type CreatedNovel = {
  id: string;
  slug: string;
};

export default function AdminCreateNovelPage() {
  const router = useRouter();
  const { token, getAuthHeader } = useAuth();
  const { form, dispatch } = useNovelForm();

  const [authors, setAuthors] = useState<Author[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
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

  const slugStatus = useSlugAvailability(form.slug);
  const disabled = useSubmitDisabled({
    token,
    title: form.title,
    slug: form.slug,
    slugStatus,
    submitting,
    uploading,
  });

  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [authorsRes, categoriesRes, tagsRes] = await Promise.allSettled([
        fetchAuthors(),
        fetchCategories(),
        fetchTags(),
      ]);
      if (cancelled) return;

      if (authorsRes.status === "fulfilled") {
        setAuthors(normalizeCollection(authorsRes.value));
      }
      if (categoriesRes.status === "fulfilled") {
        setCategories(normalizeCollection(categoriesRes.value));
      }
      if (tagsRes.status === "fulfilled") {
        setTags(normalizeCollection(tagsRes.value));
      }

      if (
        authorsRes.status === "rejected" ||
        categoriesRes.status === "rejected" ||
        tagsRes.status === "rejected"
      ) {
        setMsg((prev) =>
          prev || "Không tải được dữ liệu tham chiếu (tác giả/thể loại/tag)"
        );
      }
    })().catch(() => {
      if (!cancelled) {
        setMsg((prev) =>
          prev || "Không tải được dữ liệu tham chiếu (tác giả/thể loại/tag)"
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const doConvert = useCallback(async () => {
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

  const onSubmit = useCallback(async () => {
    if (disabled) return;
    setSubmitting(true);
    setMsg("");
    try {
      let keyToUse = uploadedKey;
      if (coverBlob && !keyToUse) {
        keyToUse = await uploadCover();
        if (!keyToUse) return;
      }
      const payload = buildCreatePayload(form, keyToUse ?? null);
      const created = (await createNovel(
        payload,
        getAuthHeader
      )) as CreatedNovel;

      try {
        await saveRelations(
          created.id,
          form.categoryIds,
          form.tagIds,
          getAuthHeader
        );
      } catch {
        // relations are best-effort; ignore errors to keep main flow smooth
      }

      setMsg("Đã tạo truyện ✓");
      window.open(
        `${READER_BASE}/truyen/${encodeURIComponent(created.slug)}`,
        "_blank"
      );
      router.replace("/novels/list");
    } catch (error: any) {
      setMsg(error?.message ?? "Lỗi tạo truyện");
    } finally {
      setSubmitting(false);
    }
  }, [
    coverBlob,
    disabled,
    form,
    getAuthHeader,
    router,
    uploadCover,
    uploadedKey,
  ]);

  const canUpload = Boolean(coverBlob) && !uploading;

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tạo truyện</h1>
        <button
          onClick={() => router.push("/novels/list")}
          className="px-3 py-2 border rounded-lg"
          type="button"
        >
          ← Danh sách
        </button>
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

      <CoverCropperSection
        image={image}
        zoom={zoom}
        setZoom={setZoom}
        onCropComplete={onCropComplete}
        pickFile={pickFile}
        doConvert={doConvert}
        canUpload={canUpload}
        uploadCover={uploadCover}
        uploading={uploading}
        coverPreview={coverPreview}
        uploadedKey={uploadedKey}
      />

      <div className="flex items-center gap-3">
        <button
          disabled={disabled}
          onClick={onSubmit}
          className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
          type="button"
        >
          {submitting ? "Đang tạo…" : "Tạo truyện"}
        </button>
        <MessageBar msg={msg} />
      </div>
    </main>
  );
}
