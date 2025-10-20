"use client";
import { CARD } from "@/app/lib/novels/constants";
import { clsx } from "@/app/lib/ui/clsx";
import type { Author, Category, Tag } from "@/app/lib/novels/types";

export function RelationsSection({
  authors,
  categories,
  tags,
  authorId,
  setAuthorIdAction,
  categoryIds,
  toggleCategoryAction,
  tagIds,
  toggleTagAction,
}: {
  authors: Author[];
  categories: Category[];
  tags: Tag[];
  authorId: string;
  setAuthorIdAction: (v: string) => void;
  categoryIds: string[];
  toggleCategoryAction: (id: string) => void;
  tagIds: string[];
  toggleTagAction: (id: string) => void;
}) {
  return (
    <section className={CARD}>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="col-span-full">
          <label className="text-sm font-medium">Tác giả</label>
          <div className="mt-2">
            <select
              className="border rounded-lg px-3 py-2"
              value={authorId}
              onChange={(e) => setAuthorIdAction(e.target.value)}
            >
              <option value="">— Không chọn —</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Pills
          title="Thể loại"
          items={categories.map((c) => ({ id: c.id, name: c.name }))}
          activeIds={categoryIds}
          toggleAction={toggleCategoryAction}
        />
        <Pills
          title="Tags"
          items={tags.map((t) => ({ id: t.id, name: t.name }))}
          activeIds={tagIds}
          toggleAction={toggleTagAction}
        />
      </div>
    </section>
  );
}

function Pills({
  title,
  items,
  activeIds,
  toggleAction,
}: {
  title: string;
  items: { id: string; name: string }[];
  activeIds: string[];
  toggleAction: (id: string) => void;
}) {
  return (
    <div className="col-span-full">
      <label className="text-sm font-medium">{title}</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((i) => {
          const active = activeIds.includes(i.id);
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => toggleAction(i.id)}
              className={clsx(
                "px-3 py-1 rounded-full border text-sm",
                active ? "bg-black text-white border-black" : "bg-white"
              )}
            >
              {i.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
