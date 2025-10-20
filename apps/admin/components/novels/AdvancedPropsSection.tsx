"use client";
import { CARD } from "@/lib/novels/constants";
import type { FormState } from "@/lib/novels/types";

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
