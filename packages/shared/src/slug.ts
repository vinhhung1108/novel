/** slugifySafe: chuyển “đ/Đ” thành “d”, bỏ dấu, giữ [a-z0-9-] */
export function slugifySafe(input: string): string {
  if (!input) return "";
  const s = input
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s;
}
