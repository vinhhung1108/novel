"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { API } from "@/app/lib/auth";

export default function LoginPage() {
  const { token, setToken } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (token) router.replace("/");
  }, [token, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`${API}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = await res.json(); // { access_token: string }
      const tk = data?.access_token;
      if (!tk) throw new Error("Thiếu access_token trong phản hồi");

      setToken?.(tk);
      router.replace("/");
    } catch (err: any) {
      setMsg(err?.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid place-items-center">
      <form
        onSubmit={submit}
        className="mt-16 w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm"
      >
        <h1 className="mb-4 text-xl font-semibold">Đăng nhập</h1>
        <p className="mb-6 text-sm text-zinc-600">
          Nhập email & mật khẩu quản trị để vào trang Admin.
        </p>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <label className="text-sm text-zinc-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              className="rounded-lg border px-3 py-2 outline-none ring-0 focus:border-zinc-400"
              placeholder="you@example.com"
              autoFocus
              required
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm text-zinc-700">Mật khẩu</label>
            <div className="flex items-stretch gap-2">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                className="flex-1 rounded-lg border px-3 py-2 outline-none ring-0 focus:border-zinc-400"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="rounded-lg border px-3 text-sm text-zinc-800 hover:bg-zinc-100"
              >
                {showPw ? "Ẩn" : "Hiện"}
              </button>
            </div>
          </div>

          {msg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {msg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </div>
      </form>
    </main>
  );
}
