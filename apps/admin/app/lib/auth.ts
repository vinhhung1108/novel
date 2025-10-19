export const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  token?: string | null
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as any),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API}${path}`, { ...init, headers, cache: "no-store" });
}
