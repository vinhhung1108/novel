// apps/admin/components/AuthProvider.tsx
"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthContextType = {
  token: string | null;
  setToken: (t: string | null) => void;
  getAuthHeader: () => Record<string, string>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("adm_token");
    if (t) setToken(t);
  }, []);
  useEffect(() => {
    if (token) localStorage.setItem("adm_token", token);
    else localStorage.removeItem("adm_token");
  }, [token]);

  const getAuthHeader = useMemo(
    () => () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const value = useMemo<AuthContextType>(
    () => ({ token, setToken, getAuthHeader }),
    [token, getAuthHeader]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
