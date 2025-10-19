export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

// Nếu server có setGlobalPrefix('v1') thì để "/v1". Nếu KHÔNG, để chuỗi rỗng "".
export const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX ?? "/v1";

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const prefix = API_PREFIX === "/" ? "" : API_PREFIX; // tránh //
  return `${API_BASE}${prefix}${p}`;
}
