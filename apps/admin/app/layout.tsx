import AdminHeader from "@/components/AdminHeader";
import AuthProvider from "@/components/AuthProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
          margin: 0,
          background: "#fafafa",
        }}
      >
        <AuthProvider>
          <AdminHeader />
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
