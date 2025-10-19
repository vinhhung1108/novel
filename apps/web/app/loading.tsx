export default function AppLoading() {
  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          height: 28,
          width: 240,
          background: "#f2f2f2",
          borderRadius: 6,
          marginBottom: 16,
        }}
      />
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 14,
            width: `${100 - (i % 6) * 8}%`,
            background: "#f2f2f2",
            borderRadius: 6,
            marginBottom: 10,
          }}
        />
      ))}
    </main>
  );
}
