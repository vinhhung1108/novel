/** slugify: chuẩn hoá unicode, thay đ/Đ -> d, lowercase, nối bằng "-" */
export function slugifySafe(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFD") // tách dấu
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu
    .replace(/[đĐ]/g, "d") // đ/Đ -> d
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // ngoài a-z0-9 -> "-"
    .replace(/-+/g, "-") // gộp "-"
    .replace(/(^-|-$)/g, ""); // bỏ "-" đầu/cuối
}
