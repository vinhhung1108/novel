export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="vi">
<body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto", margin: 0 }}>
{children}
</body>
</html>
);
}