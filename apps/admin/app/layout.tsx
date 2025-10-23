import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import AdminHeader from "@/components/AdminHeader";
import { ThemeProvider } from "next-themes";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <AdminHeader />
            <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
