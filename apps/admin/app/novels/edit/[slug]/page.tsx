"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import Cropper from "react-easy-crop";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "../../../../lib/auth";
import { cropToWebp, fileToImage } from "../../../../lib/crop";
import { slugify } from "../../../../lib/slug";
import { useDebouncedValue } from "../../../../lib/useDebounce";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
const CDN =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ?? "http://localhost:9000/novels";

const COVER_W = 600;
const COVER_H = 800;
const ASPECT = 3 / 4;

export default function EditNovelPage() {
  const params = useParams<{ slug: string }>();
  const slugParam = decodeURIComponent(params.slug);
  const { token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [novel, setNovel] = useState<any | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [autoSlug, setAutoSlug] = useState(false);
  const [description, setDescription] = useState("");
  const [coverKey, setCoverKey] = useState<string | null>(null);

  // slug check
  const debouncedSlug = useDebouncedValue(slug, 400);
  const [slugExists, setSlugExists] = useState<null | boolean>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [imgForCrop, setImgForCrop] = useState<HTMLImageElement | null>(null);
  const [croppedArea, setCroppedArea] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [webpBlob, setWebpBlob] = useState<Blob | null>(null);
  const [webpPreview, setWebpPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(
        `${API}/v1/novels/${encodeURIComponent(slugParam)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setLoading(false);
        notFound();
        return;
      }
      const n = await res.json();
      setNovel(n);
      setTitle(n.title ?? "");
      setSlug(n.slug ?? "");
      setDescription(n.description ?? "");
      setCoverKey(n.cover_image_key ?? null);
      setLoading(false);
    })();
  }, [slugParam]);

  useEffect(() => {
    if (autoSlug) setSlug(slugify(title));
  }, [title, autoSlug]);

  useEffect(() => {
    (async () => {
      setSlugExists(null);
      if (!novel) return;
      if (!debouncedSlug.trim()) return;
      if (debouncedSlug === novel.slug) {
        setSlugExists(false);
        return;
      }
      setCheckingSlug(true);
      const res = await fetch(
        `${API}/v1/novels/slug-exists?slug=${encodeURIComponent(debouncedSlug)}`,
        { cache: "no-store" }
      );
      setCheckingSlug(false);
      if (!res.ok) {
        setSlugExists(null);
        return;
      }
      const data = await res.json();
      setSlugExists(Boolean(data?.exists));
    })();
  }, [debouncedSlug, novel]);

  const disabled = useMemo(
    () =>
      !token ||
      !novel ||
      !title.trim() ||
      !slug.trim() ||
      slugExists === true ||
      saving,
    [token, novel, title, slug, slugExists, saving]
  );

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setWebpBlob(null);
    setWebpPreview(null);
    if (f) {
      const img = await fileToImage(f);
      setImgForCrop(img);
      setZoom(1);
      setCroppedArea(null);
    } else {
      setImgForCrop(null);
    }
  };

  const onCropComplete = useCallback((_area: any, areaPixels: any) => {
    setCroppedArea({
      x: Math.max(0, Math.round(areaPixels.x)),
      y: Math.max(0, Math.round(areaPixels.y)),
      width: Math.max(1, Math.round(areaPixels.width)),
      height: Math.max(1, Math.round(areaPixels.height)),
    });
  }, []);

  const doCropToWebp = async () => {
    if (!imgForCrop || !croppedArea) {
      setMsg("Chưa chọn vùng crop");
      return;
    }
    const { blob, dataUrl } = await cropToWebp(
      imgForCrop,
      croppedArea,
      COVER_W,
      COVER_H,
      0.86
    );
    setWebpBlob(blob);
    setWebpPreview(dataUrl);
    setMsg("Đã crop & chuyển WebP ✓");
  };

  const uploadWebp = async (): Promise<string | null> => {
    if (!webpBlob) {
      setMsg("Chưa có ảnh WebP để upload");
      return null;
    }
    setSaving(true);
    setMsg("");
    const presignRes = await fetch(`${API}/v1/upload/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ext: "webp", contentType: "image/webp" }),
      cache: "no-store",
    });
    if (!presignRes.ok) {
      setMsg(`Không lấy được URL ký sẵn: ${presignRes.status}`);
      setSaving(false);
      return null;
    }
    const { url, key } = await presignRes.json();
    const putRes = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "image/webp" },
      body: webpBlob,
    });
    if (!putRes.ok) {
      setMsg(`Upload cover thất bại: ${putRes.status}`);
      setSaving(false);
      return null;
    }
    setSaving(false);
    return key as string;
  };

  const save = async () => {
    if (disabled || !novel) return;
    if (slugExists === true) {
      setMsg("Slug đã tồn tại, vui lòng đổi slug khác.");
      return;
    }

    setSaving(true);
    setMsg("");

    let keyToUse = coverKey;
    if (webpBlob) {
      const k = await uploadWebp();
      if (!k) {
        setSaving(false);
        return;
      }
      keyToUse = k;
    }

    const res = await apiFetch(
      `/v1/novels/${novel.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title,
          slug,
          description,
          cover_image_key: keyToUse ?? undefined,
        }),
      },
      token
    );

    setSaving(false);

    if (!res.ok) {
      const t = await res.text();
      setMsg(`Lỗi lưu: ${t}`);
      return;
    }
    const json = await res.json();
    setMsg("Đã lưu ✓");
    setCoverKey(json.cover_image_key ?? keyToUse ?? null);
    if (json.slug && json.slug !== slugParam) {
      router.replace(`/novels/edit/${encodeURIComponent(json.slug)}`);
    }
  };

  if (loading)
    return (
      <main style={{ padding: 24 }}>
        <p>Đang tải…</p>
      </main>
    );
  if (!novel)
    return (
      <main style={{ padding: 24 }}>
        <p>Không tìm thấy truyện.</p>
      </main>
    );

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h1>Sửa Truyện</h1>

      <section
        style={{
          border: "1px solid #eee",
          padding: 16,
          borderRadius: 12,
          display: "grid",
          gap: 12,
          maxWidth: 820,
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề"
        />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setAutoSlug(false);
            }}
            placeholder="Slug"
            style={{ flex: 1 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={autoSlug}
              onChange={(e) => {
                setAutoSlug(e.target.checked);
                if (e.target.checked) setSlug(slugify(title));
              }}
            />
            Auto slug
          </label>
          <button
            onClick={() => setSlug(slugify(title))}
            style={{ padding: "6px 10px", borderRadius: 8 }}
          >
            Tạo từ tiêu đề
          </button>
        </div>
        {slug && (
          <p style={{ margin: 0, fontSize: 12 }}>
            {checkingSlug ? (
              "Đang kiểm tra slug…"
            ) : slugExists === true ? (
              <span style={{ color: "crimson" }}>Slug đã tồn tại</span>
            ) : slugExists === false ? (
              <span style={{ color: "green" }}>Slug khả dụng</span>
            ) : (
              <span style={{ color: "#666" }}>Không kiểm tra được slug</span>
            )}
          </p>
        )}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder="Mô tả"
        />

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div
            style={{
              width: 160,
              height: 213,
              background: "#f5f5f5",
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
            }}
          >
            {coverKey ? (
              <img
                src={`${CDN}/${coverKey}`}
                alt="Cover hiện tại"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ color: "#888", fontSize: 12 }}>Chưa có cover</span>
            )}
          </div>
          <a
            href={`http://localhost:3000/truyen/${encodeURIComponent(slug)}`}
            target="_blank"
            rel="noreferrer"
          >
            Xem trên web
          </a>
          <Link href={`/novels/${encodeURIComponent(slug)}/chapters`}>
            Quản lý chương
          </Link>
        </div>

        {/* Thay cover mới */}
        <div style={{ display: "grid", gap: 10 }}>
          <input type="file" accept="image/*" onChange={onPickFile} />
          {imgForCrop && (
            <div style={{ display: "grid", gap: 8 }}>
              <div
                style={{
                  position: "relative",
                  width: 600,
                  height: 400,
                  background: "#111",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <Cropper
                  image={imgForCrop?.src}
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
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label>Zoom</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
                <button
                  onClick={doCropToWebp}
                  style={{ padding: "6px 10px", borderRadius: 8 }}
                >
                  Cắt & Convert WebP
                </button>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div
                  style={{
                    width: 160,
                    height: 213,
                    background: "#f5f5f5",
                    borderRadius: 8,
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                  }}
                >
                  {webpPreview ? (
                    <img
                      src={webpPreview}
                      alt="Preview (WebP)"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span style={{ color: "#888", fontSize: 12 }}>
                      Preview WebP
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <button
            disabled={disabled}
            onClick={save}
            style={{ padding: "8px 14px", borderRadius: 8 }}
          >
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
          {msg && (
            <span
              style={{
                marginLeft: 12,
                color: msg.startsWith("Lỗi") ? "crimson" : "green",
              }}
            >
              {msg}
            </span>
          )}
        </div>
      </section>
    </main>
  );
}
