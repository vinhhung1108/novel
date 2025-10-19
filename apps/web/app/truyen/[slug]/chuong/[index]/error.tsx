"use client";

export default function ErrorChapter({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ padding: 24, maxWidth: 760, margin: "0 auto" }}>
      <h1>Không tải được chương</h1>
      <p style={{ color: "#666" }}>
        {error.message || "Đã xảy ra lỗi không xác định."}
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: "8px 14px",
          borderRadius: 8,
          border: "1px solid #ddd",
          cursor: "pointer",
        }}
      >
        Thử lại
      </button>
    </main>
  );
}
