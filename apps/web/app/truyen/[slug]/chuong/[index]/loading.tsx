export default function LoadingChapter() {
  return (
    <main style={{ padding: 24, maxWidth: 760, margin: "0 auto" }}>
      <div
        style={{
          width: 260,
          height: 20,
          background: "#f2f2f2",
          borderRadius: 6,
          marginBottom: 12,
        }}
      />
      <div
        style={{
          width: "70%",
          height: 28,
          background: "#f2f2f2",
          borderRadius: 6,
          marginBottom: 16,
        }}
      />
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: `${90 - (i % 5) * 6}%`,
            height: 14,
            background: "#f2f2f2",
            borderRadius: 6,
            marginBottom: 10,
          }}
        />
      ))}
    </main>
  );
}
