export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

// Nếu server có setGlobalPrefix('v1') thì để "/v1". Nếu KHÔNG, để chuỗi rỗng "".
export const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX ?? "/v1";

const RAW_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") ??
  "http://localhost:4000";

function withV1(base: string) {
  // Nếu base đã có /v1 ở cuối thì giữ nguyên, nếu chưa thì gắn vào
  if (/\/v1$/.test(base)) return base;
  return `${base}/v1`;
}

export function apiUrl(path: string) {
  const base = withV1(RAW_BASE);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
