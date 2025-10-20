import { useEffect, useMemo, useReducer } from "react";
import type { FormState } from "@/app/lib/novels/types";
import { nextSlugFromTitle } from "@/app/lib/novels/helpers";

export const INITIAL_FORM: FormState = {
  title: "",
  slug: "",
  autoSlug: true,
  description: "",
  originalTitle: "",
  altTitles: "",
  languageCode: "vi",
  isFeatured: false,
  mature: false,
  priority: 0,
  authorId: "",
  categoryIds: [],
  tagIds: [],
  status: "ongoing",
  source: "local",
  sourceUrl: "",
  publishedAt: "",
};

type FormAction =
  | { type: "set"; field: keyof FormState; value: any }
  | { type: "setMany"; values: Partial<FormState> }
  | { type: "toggleArr"; field: "categoryIds" | "tagIds"; value: string };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "setMany":
      return { ...state, ...action.values };
    case "toggleArr": {
      const next = new Set(state[action.field]);
      next.has(action.value)
        ? next.delete(action.value)
        : next.add(action.value);
      return { ...state, [action.field]: Array.from(next) } as FormState;
    }
    default:
      return state;
  }
}

export function useNovelForm() {
  const [form, dispatch] = useReducer(formReducer, INITIAL_FORM);

  // auto-slug sync
  useEffect(() => {
    const next = nextSlugFromTitle(form.title, form.slug, form.autoSlug);
    if (next !== form.slug) {
      dispatch({ type: "set", field: "slug", value: next });
    }
  }, [form.title, form.slug, form.autoSlug]);

  return { form, dispatch };
}

export function useSubmitDisabled({
  token,
  title,
  slug,
  slugStatus,
  submitting,
  uploading,
}: {
  token: string | null | undefined;
  title: string;
  slug: string;
  slugStatus: "idle" | "checking" | "available" | "taken" | "invalid" | "error";
  submitting: boolean;
  uploading: boolean;
}) {
  return useMemo(() => {
    const hasBasics = title.trim() && slug.trim();
    const slugInvalid = slugStatus === "taken" || slugStatus === "invalid";
    return (
      !token ||
      !hasBasics ||
      slugInvalid ||
      submitting ||
      uploading ||
      slugStatus === "checking"
    );
  }, [token, title, slug, slugStatus, submitting, uploading]);
}
