/** Tạo slug “an toàn” cho tiếng Việt (chuyển đ→d, loại dấu, chuẩn hoá) */
export function slugifySafe(input: string): string {
  return input
    .toLowerCase()
    .replace(/đ/g, "d") // đ → d (đã toLowerCase nên không cần Đ)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu tổ hợp
    .replace(/[^a-z0-9]+/g, "-") // giữ a-z0-9, còn lại thành "-"
    .replace(/-+/g, "-") // gộp nhiều dấu "-"
    .replace(/^-|-$/g, ""); // bỏ "-" đầu/cuối
}

/** Kiểm tra slug hợp lệ theo quy ước hệ thống */
export function isValidSlug(s: string): boolean {
  return /^[a-z0-9-]+$/.test(s) && s === s.toLowerCase();
}
