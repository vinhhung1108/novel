// Đếm số từ thô từ HTML
export function wordCountFromHtml(html?: string): number {
  if (!html) return 0;
  const txt = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return txt ? txt.split(" ").length : 0;
}
