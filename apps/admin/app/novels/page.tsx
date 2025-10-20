"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

const cards: Array<{
  title: string;
  description: string;
  href: string;
  primary?: boolean;
}> = [
  {
    title: "Thêm truyện mới",
    description: "Bắt đầu nhập thông tin, upload bìa và gán tác giả/thể loại.",
    href: "/novels/new",
    primary: true,
  },
  {
    title: "Quản lý truyện",
    description: "Xem danh sách, chỉnh sửa nội dung và trạng thái truyện.",
    href: "/novels/list",
  },
  {
    title: "Thống kê & phân tích",
    description:
      "Theo dõi lượt xem, số chương mới và các chỉ số quan trọng khác.",
    href: "/stats",
  },
  {
    title: "Trình quản lý chương",
    description: "Chỉnh sửa, thêm hoặc xoá chương cho từng truyện.",
    href: "/novels/list?focus=chapters",
  },
];

export default function NovelsHubPage() {
  const router = useRouter();
  const { token } = useAuth();

  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Trung tâm quản lý truyện
        </h1>
        <p className="text-sm text-gray-600">
          Chọn một tác vụ để tiếp tục. Bạn có thể tạo truyện mới, chỉnh sửa nội
          dung hiện có hoặc xem báo cáo tổng quan.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={[
              "block rounded-2xl border border-gray-200 bg-white p-6 transition-shadow",
              "hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
              card.primary ? "border-black" : "",
            ].join(" ")}
          >
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{card.description}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-black">
              Đi tới {card.title.toLowerCase()}
              <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-700">
        <h3 className="text-base font-semibold text-gray-900">
          Gợi ý quy trình làm việc
        </h3>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>Tạo truyện mới và nhập thông tin cơ bản.</li>
          <li>Gán tác giả, thể loại, tags cho truyện vừa tạo.</li>
          <li>Thêm chương hoặc chỉnh sửa nội dung từ trình quản lý chương.</li>
          <li>Theo dõi hiệu suất truyện trong mục thống kê.</li>
        </ol>
      </section>
    </main>
  );
}
