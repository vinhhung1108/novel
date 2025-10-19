export default function LoadingNovel() {
  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div
          style={{
            width: 180,
            height: 240,
            background: "#f2f2f2",
            borderRadius: 8,
            animation: "pulse 1.2s ease-in-out infinite",
          }}
        />
        <div>
          <div
            style={{
              width: "60%",
              height: 28,
              background: "#f2f2f2",
              borderRadius: 6,
              marginBottom: 12,
            }}
          />
          <div
            style={{
              width: "100%",
              height: 14,
              background: "#f2f2f2",
              borderRadius: 6,
              marginBottom: 8,
            }}
          />
          <div
            style={{
              width: "90%",
              height: 14,
              background: "#f2f2f2",
              borderRadius: 6,
              marginBottom: 8,
            }}
          />
          <div
            style={{
              width: "80%",
              height: 14,
              background: "#f2f2f2",
              borderRadius: 6,
            }}
          />
        </div>
      </div>
      <h2 style={{ marginTop: 24 }}>Danh sách chương</h2>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <li key={i} style={{ marginBottom: 8 }}>
            <span
              style={{
                display: "inline-block",
                width: 260,
                height: 14,
                background: "#f2f2f2",
                borderRadius: 6,
              }}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
