"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/auth";
import { cropToWebp, fileToImage } from "@/lib/crop";
import { slugifySafe as slugify } from "@/lib/slug"; // <-- dùng util cục bộ
import { useDebouncedValue } from "@/lib/useDebounce";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
const CDN =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ?? "http://localhost:9000/novels";

const COVER_W = 600;
const COVER_H = 800;
const ASPECT = 3 / 4;

export default function AdminNovelsCreate() {
  const { token } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [autoSlug, setAutoSlug] = useState(true);
  const [description, setDescription] = useState("");

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
  const [coverKey, setCoverKey] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  // slug check
  const debouncedSlug = useDebouncedValue(slug, 400);
  const [slugExists, setSlugExists] = useState<null | boolean>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  useEffect(() => {
    if (autoSlug) setSlug(slugify(title));
  }, [title, autoSlug]);

  useEffect(() => {
    (async () => {
      setSlugExists(null);
      const s = debouncedSlug.trim();
      if (!s) return;
      setCheckingSlug(true);
      try {
        // ĐÚNG route: /novels/slug-exists/:slug
        const res = await fetch(
          `${API}/v1/novels/slug-exists/${encodeURIComponent(s)}`,
          { cache: "no-store" }
        );
        const data = res.ok ? await res.json() : null;
        setSlugExists(Boolean(data?.exists));
      } catch {
        setSlugExists(null);
      } finally {
        setCheckingSlug(false);
      }
    })();
  }, [debouncedSlug]);

  const disabled = useMemo(
    () =>
      !token ||
      !title.trim() ||
      !slug.trim() ||
      slugExists === true ||
      uploading,
    [token, title, slug, slugExists, uploading]
  );

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setWebpBlob(null);
    setWebpPreview(null);
    setCoverKey(null);
    setMsg("");
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
    setUploading(true);
    setMsg("");
    try {
      const presignRes = await fetch(`${API}/v1/upload/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ext: "webp", contentType: "image/webp" }),
        cache: "no-store",
      });
      if (!presignRes.ok) {
        setMsg(`Không lấy được URL ký sẵn: ${presignRes.status}`);
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
        return null;
      }
      setMsg("Đã upload cover ✓");
      return key as string;
    } finally {
      setUploading(false);
    }
  };

  const createNovel = async () => {
    if (disabled) return;
    if (slugExists === true) {
      setMsg("Slug đã tồn tại, vui lòng đổi slug khác.");
      return;
    }

    let keyToUse = coverKey;
    if (webpBlob && !coverKey) {
      keyToUse = await uploadWebp();
      if (!keyToUse) return;
      setCoverKey(keyToUse);
    }

    const res = await apiFetch(
      `/v1/novels`,
      {
        method: "POST",
        body: JSON.stringify({
          title,
          slug, // dùng slug user thấy trong input
          description,
          cover_image_key: keyToUse ?? undefined,
        }),
      },
      token
    );

    if (!res.ok) {
      const t = await res.text();
      setMsg(`Lỗi tạo truyện: ${t}`);
      return;
    }
    const json = await res.json();
    setMsg("Đã tạo truyện ✓");
    window.open(`http://localhost:3000/truyen/${json.slug}`, "_blank");

    // reset form
    setTitle("");
    setSlug("");
    setDescription("");
    setFile(null);
    setImgForCrop(null);
    setCroppedArea(null);
    setWebpBlob(null);
    setWebpPreview(null);
    setCoverKey(null);
    setZoom(1);
    setSlugExists(null);
  };

  const hasImage = !!imgForCrop;
  const canUpload = !!webpBlob && !uploading;

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h1>Admin — Tạo Truyện</h1>

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
            placeholder="Slug (auto từ tiêu đề nếu bật Auto)"
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

        {/* Chọn & crop ảnh */}
        <div style={{ display: "grid", gap: 10 }}>
          <input type="file" accept="image/*" onChange={onPickFile} />
          {hasImage && (
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
                <button
                  disabled={canUpload ? false : true}
                  onClick={async () => {
                    const k = await uploadWebp();
                    if (k) setCoverKey(k);
                  }}
                  style={{ padding: "6px 10px", borderRadius: 8 }}
                >
                  {uploading ? "Đang upload..." : "Upload cover"}
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
                {coverKey && (
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
                    <img
                      src={`${CDN}/${coverKey}`}
                      alt="Đã upload"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <button
            disabled={disabled}
            onClick={createNovel}
            style={{ padding: "8px 14px", borderRadius: 8 }}
          >
            {uploading ? "Đang tải ảnh…" : "Tạo truyện"}
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
