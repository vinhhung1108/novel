// Chuẩn hoá slug: chuyển đ/Đ -> d, bỏ dấu, chỉ còn [a-z0-9-]
export function slugifySafe(input: string): string {
  if (!input) return "";
  const replaced = input.replace(/[đĐ]/g, "d");
  return replaced
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
