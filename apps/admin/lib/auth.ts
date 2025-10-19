export async function apiFetch(
  path: string,
  init: RequestInit = {},
  token?: string | null
) {
  const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
  const headers = new Headers(init.headers || {});
  headers.set(
    "Content-Type",
    headers.get("Content-Type") || "application/json"
  );
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API}${path.startsWith("/") ? "" : "/"}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
