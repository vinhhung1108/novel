"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/novels/list", label: "Truyện", icon: "📚" },
  { href: "/categories", label: "Thể loại", icon: "🗂️" },
  { href: "/tags", label: "Tags", icon: "🏷️" },
  { href: "/authors", label: "Tác giả", icon: "✍️" },
  { href: "/crawl", label: "Crawler", icon: "🕷️" },
];

export default function AdminHeader() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const renderedNav = useMemo(
    () =>
      navItems.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-zinc-900 text-white shadow"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      }),
    [pathname]
  );

  const authAction = () => {
    if (!token) {
      router.push("/login");
      return;
    }
    logout();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-zinc-900 text-white">
            A
          </span>
          <span className="text-zinc-900">Admin Console</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {renderedNav}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={authAction}
            className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            {token ? "Đăng xuất" : "Đăng nhập"}
          </button>
        </div>
      </div>

      <nav className="mx-auto flex items-center gap-1 px-4 pb-3 pt-2 md:hidden">
        {renderedNav}
      </nav>
    </header>
  );
}
