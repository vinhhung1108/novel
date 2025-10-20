"use client";
import { CARD } from "@/lib/novels/constants";
import type { SlugStatus } from "@/lib/novels/types";
import { clsx } from "@/lib/ui/clsx";
import { slugifySafe } from "@/app/lib/slug";

export function BasicInfoSection({
  title,
  slug,
  autoSlug,
  setTitleAction,
  setSlugAction,
  setAutoSlugAction,
  description,
  setDescriptionAction,
  slugStatus,
}: {
  title: string;
  slug: string;
  autoSlug: boolean;
  setTitleAction: (v: string) => void;
  setSlugAction: (v: string) => void;
  setAutoSlugAction: (v: boolean) => void;
  description: string;
  setDescriptionAction: (v: string) => void;
  slugStatus: SlugStatus;
}) {
  const feedback = (() => {
    switch (slugStatus) {
      case "checking":
        return { text: "Đang kiểm tra slug…", tone: "muted" as const };
      case "available":
        return { text: "Slug khả dụng", tone: "positive" as const };
      case "taken":
        return { text: "Slug đã tồn tại", tone: "danger" as const };
      case "invalid":
        return {
          text: "Slug không hợp lệ (chỉ gồm a-z, 0-9 và '-')",
          tone: "danger" as const,
        };
      case "error":
        return { text: "Không kiểm tra được slug", tone: "muted" as const };
      default:
        return { text: null, tone: "muted" as const };
    }
  })();

  return (
    <section className={CARD}>
      <input
        className="border rounded-lg px-3 py-2"
        placeholder="Tiêu đề"
        value={title}
        onChange={(e) => setTitleAction(e.target.value)}
      />

      <div className="flex items-center gap-3">
        <input
          className="border rounded-lg px-3 py-2 flex-1"
          placeholder="Slug (auto từ tiêu đề nếu bật Auto)"
          value={slug}
          onChange={(e) => {
            setSlugAction(e.target.value);
            setAutoSlugAction(false);
          }}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoSlug}
            onChange={(e) => setAutoSlugAction(e.target.checked)}
          />
          Auto
        </label>
        <button
          onClick={() => setSlugAction(slugifySafe(title))}
          className="border rounded-lg px-3 py-2"
          type="button"
        >
          Tạo từ tiêu đề
        </button>
      </div>

      {slug && feedback.text ? (
        <p
          className={clsx(
            "text-sm",
            feedback.tone === "danger" && "text-red-600",
            feedback.tone === "positive" && "text-green-600",
            feedback.tone === "muted" && "text-gray-600"
          )}
        >
          {feedback.text}
        </p>
      ) : null}

      <textarea
        className="border rounded-lg px-3 py-2 min-h-32"
        placeholder="Mô tả"
        value={description}
        onChange={(e) => setDescriptionAction(e.target.value)}
      />
    </section>
  );
}
