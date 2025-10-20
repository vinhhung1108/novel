"use client";
import Cropper from "react-easy-crop";
import { CARD, ASPECT, CDN_BASE } from "@/app/lib/novels/constants";
import type { CropArea } from "@/app/lib/novels/types";

type Props = {
  image: HTMLImageElement | null;
  zoom: number;
  setZoom: (value: number) => void;
  onCropComplete: (_: unknown, area: CropArea) => void;
  pickFile: (file: File | null) => void;
  doConvert: () => Promise<void>;
  canUpload: boolean;
  uploadCover: () => Promise<string | null>;
  uploading: boolean;
  coverPreview: string | null;
  uploadedKey: string | null;
  showPicker?: boolean;
};

export function CoverCropperSection({
  image,
  zoom,
  setZoom,
  onCropComplete,
  pickFile,
  doConvert,
  canUpload,
  uploadCover,
  uploading,
  coverPreview,
  uploadedKey,
  showPicker = true,
}: Props) {
  return (
    <section className={CARD}>
      {showPicker && (
        <input
          type="file"
          accept="image/*"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      )}
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
              onClick={() => {
                void doConvert();
              }}
              className="border rounded-lg px-3 py-2"
              type="button"
            >
              Cắt & Convert WebP
            </button>
            <button
              disabled={!canUpload}
              onClick={() => {
                void uploadCover();
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
  );
}
