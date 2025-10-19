"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  PropsWithChildren,
} from "react";

type AuthContextType = {
  token: string | null | undefined; // undefined: đang init, null: chưa đăng nhập
  login: (usernameOrEmail: string, password: string) => Promise<boolean>;
  logout: () => void;
  authFetch: typeof fetch; // fetch có kèm Bearer token
  getAuthHeader: () => Record<string, string>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
const STORAGE_KEY = "admin_token";

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider />");
  }
  return ctx;
}

export default function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null | undefined>(undefined);

  // Bootstrap token từ localStorage
  useEffect(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      setToken(t || null);
    } catch {
      setToken(null);
    }
  }, []);

  const login = useCallback(
    async (usernameOrEmail: string, password: string) => {
      try {
        const res = await fetch(`${API}/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ usernameOrEmail, password }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { access_token?: string };
        if (!data?.access_token) return false;
        localStorage.setItem(STORAGE_KEY, data.access_token);
        setToken(data.access_token);
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setToken(null);
  }, []);

  // ✅ Fix kiểu trả về rõ ràng để TS không suy luận union kỳ quặc
  const getAuthHeader = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    return headers;
  }, [token]);

  // fetch có kèm Bearer token
  const authFetch: typeof fetch = useCallback(
    (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ) => {
      const headers = new Headers(init?.headers ?? {});
      const extra = getAuthHeader();
      Object.entries(extra).forEach(([k, v]) => headers.set(k, v));
      return fetch(input, { ...init, headers });
    },
    [getAuthHeader]
  );

  const value = useMemo<AuthContextType>(
    () => ({ token, login, logout, authFetch, getAuthHeader }),
    [token, login, logout, authFetch, getAuthHeader]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
