"use client";
import { CARD } from "@/app/lib/novels/constants";
import type { FormState } from "@/app/lib/novels/types";

const STATUS_OPTIONS = [
  { value: "ongoing", label: "Đang ra" },
  { value: "completed", label: "Hoàn thành" },
  { value: "hiatus", label: "Tạm dừng" },
];

export function AdvancedPropsSection({
  originalTitle,
  setOriginalTitleAction,
  languageCode,
  setLanguageCodeAction,
  altTitles,
  setAltTitlesAction,
  isFeatured,
  setIsFeaturedAction,
  mature,
  setMatureAction,
  priority,
  setPriorityAction,
  status,
  setStatusAction,
  source,
  setSourceAction,
  sourceUrl,
  setSourceUrlAction,
  publishedAt,
  setPublishedAtAction,
}: {
  originalTitle: FormState["originalTitle"];
  setOriginalTitleAction: (v: string) => void;
  languageCode: FormState["languageCode"];
  setLanguageCodeAction: (v: string) => void;
  altTitles: FormState["altTitles"];
  setAltTitlesAction: (v: string) => void;
  isFeatured: FormState["isFeatured"];
  setIsFeaturedAction: (v: boolean) => void;
  mature: FormState["mature"];
  setMatureAction: (v: boolean) => void;
  priority: FormState["priority"];
  setPriorityAction: (v: number) => void;
  status: FormState["status"];
  setStatusAction: (v: string) => void;
  source: FormState["source"];
  setSourceAction: (v: string) => void;
  sourceUrl: FormState["sourceUrl"];
  setSourceUrlAction: (v: string) => void;
  publishedAt: FormState["publishedAt"];
  setPublishedAtAction: (v: string) => void;
}) {
  return (
    <section className={CARD}>
      <div className="grid md:grid-cols-2 gap-3">
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Tên gốc (original_title)"
          value={originalTitle}
          onChange={(e) => setOriginalTitleAction(e.target.value)}
        />
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Mã ngôn ngữ (vd: vi, en, ja)"
          value={languageCode}
          onChange={(e) => setLanguageCodeAction(e.target.value)}
        />
        <textarea
          className="border rounded-lg px-3 py-2 col-span-full min-h-24"
          placeholder="Tên thay thế (alt_titles) — mỗi dòng 1 tên"
          value={altTitles}
          onChange={(e) => setAltTitlesAction(e.target.value)}
        />
        <label className="flex items-center gap-2">
          Trạng thái
          <select
            className="border rounded-lg px-2 py-1"
            value={status}
            onChange={(e) => setStatusAction(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Nguồn
          <input
            className="border rounded-lg px-2 py-1"
            value={source}
            onChange={(e) => setSourceAction(e.target.value)}
            placeholder="local / crawler"
          />
        </label>
        <label className="flex items-center gap-2">
          URL nguồn
          <input
            className="border rounded-lg px-2 py-1 flex-1"
            value={sourceUrl}
            onChange={(e) => setSourceUrlAction(e.target.value)}
            placeholder="https://..."
          />
        </label>
        <label className="flex items-center gap-2">
          Ngày phát hành
          <input
            type="date"
            className="border rounded-lg px-2 py-1"
            value={publishedAt}
            onChange={(e) => setPublishedAtAction(e.target.value)}
          />
        </label>
        <div className="flex items-center gap-6 col-span-full">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeaturedAction(e.target.checked)}
            />{" "}
            Featured
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mature}
              onChange={(e) => setMatureAction(e.target.checked)}
            />{" "}
            Mature
          </label>
          <label className="flex items-center gap-2">
            Priority
            <input
              type="number"
              className="border rounded-lg px-2 py-1 w-24"
              value={priority}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPriorityAction(Number.isFinite(v) ? v : 0);
              }}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
