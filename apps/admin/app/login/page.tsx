"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { token, login } = useAuth();

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // nếu đã có token thì về trang chủ admin
  useEffect(() => {
    if (token) router.replace("/");
  }, [token, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const ok = await login(usernameOrEmail, password);
    setLoading(false);
    if (ok) router.replace("/");
    else setErr("Thông tin đăng nhập chưa đúng");
  };

  return (
    <main
      style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: 360,
          display: "grid",
          gap: 12,
          padding: 24,
          border: "1px solid #eee",
          borderRadius: 12,
        }}
      >
        <h1 style={{ margin: 0 }}>Đăng nhập</h1>
        <input
          value={usernameOrEmail}
          onChange={(e) => setUsernameOrEmail(e.target.value)}
          placeholder="Username hoặc email"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mật khẩu"
        />
        <button
          type="submit"
          disabled={loading || !usernameOrEmail.trim() || !password}
          style={{ padding: "8px 14px", borderRadius: 8 }}
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
        {err && <p style={{ color: "crimson", margin: 0 }}>{err}</p>}
        <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
          Mẹo: tài khoản seed của bạn là <code>admin / admin123</code> (nếu đã
          tạo).
        </p>
      </form>
    </main>
  );
}
