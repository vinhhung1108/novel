import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import AdminHeader from "@/components/AdminHeader";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-zinc-50 text-zinc-900">
        <AuthProvider>
          <AdminHeader />
          <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
