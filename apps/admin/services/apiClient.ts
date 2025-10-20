import { apiUrl } from "@/app/lib/api";

export type AuthHeaderGetter = () => Record<string, string>;

export async function apiGet<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(apiUrl(path), { cache: "no-store", ...init });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  getAuthHeader?: AuthHeaderGetter
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getAuthHeader?.() ?? {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}
