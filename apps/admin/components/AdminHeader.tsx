"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active =
    pathname === href ||
    (href !== "/" && pathname?.startsWith(href) && href !== "/login");
  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-lg text-sm no-underline ${
        active ? "bg-zinc-900 text-white" : "text-zinc-800 hover:bg-zinc-100"
      }`}
    >
      {children}
    </Link>
  );
}

export default function AdminHeader() {
  const { token, logout } = useAuth();
  const router = useRouter();

  const doLogout = () => {
    logout?.();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link href="/" className="font-semibold text-zinc-900">
          Admin
        </Link>
        <nav className="ml-4 flex items-center gap-1">
          <NavLink href="/">Dashboard</NavLink>
          <NavLink href="/novels/list">Truyện</NavLink>
          {/* Nếu đã có route, bạn mở thêm:
          <NavLink href="/authors">Tác giả</NavLink>
          <NavLink href="/tags">Tag</NavLink>
          */}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {token ? (
            <button
              onClick={doLogout}
              className="rounded-lg border px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-100"
            >
              Đăng xuất
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-100"
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
