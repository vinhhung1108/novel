// apps/admin/lib/slug.ts
/** slugify có xử lý đ/Đ -> d và loại bỏ dấu tiếng Việt */
export function slugifySafe(input: string): string {
  if (!input) return "";
  // chuẩn hoá unicode + bỏ dấu
  const noAccent = input
    .toLowerCase()
    // chuyển riêng đ/Đ
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return noAccent
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
