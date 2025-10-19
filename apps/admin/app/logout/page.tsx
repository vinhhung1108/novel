"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LogoutPage() {
  const { logout } = useAuth();
  const router = useRouter();
  useEffect(() => {
    logout();
    router.replace("/login");
  }, [logout, router]);

  return (
    <main style={{ minHeight: "60dvh", display: "grid", placeItems: "center" }}>
      <p>Đang đăng xuất…</p>
    </main>
  );
}
