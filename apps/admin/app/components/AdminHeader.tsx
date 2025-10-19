"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function AdminHeader() {
  const { token, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const nav = [
    { href: "/", label: "Dashboard" },
    { href: "/novels/list", label: "Truyện" },
    { href: "/novels", label: "Tạo truyện" },
  ];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "#fff",
        borderBottom: "1px solid #eee",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          padding: "10px 16px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          style={{
            fontWeight: 700,
            fontSize: 18,
            color: "#111",
            textDecoration: "none",
          }}
        >
          Admin
        </Link>

        <nav style={{ display: "flex", gap: 12, flex: 1 }}>
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  textDecoration: "none",
                  color: active ? "#111" : "#444",
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: active ? "#f3f4f6" : "transparent",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {token ? (
          <button
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Đăng xuất
          </button>
        ) : (
          <Link
            href="/login"
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
              textDecoration: "none",
              color: "#111",
            }}
          >
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}
