"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Time from "@/components/Time";
import { useAuth } from "@/components/AuthProvider";
import { API } from "./lib/auth";

export default function Dashboard() {
  const { token } = useAuth();
  const [counts, setCounts] = useState<any>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [top, setTop] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [c, s, t] = await Promise.all([
        fetch(`${API}/v1/stats`)
          .then((r) => r.json())
          .catch(() => null),
        fetch(`${API}/v1/stats/series?granularity=day&range=7`)
          .then((r) => r.json())
          .catch(() => ({ items: [] })),
        fetch(`${API}/v1/stats/top?days=7&limit=5`)
          .then((r) => r.json())
          .catch(() => ({ items: [] })),
      ]);
      setCounts(c);
      setSeries(s.items || []);
      setTop(t.items || []);
    })();
  }, [token]);

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1>Bảng điều khiển</h1>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))",
          gap: 12,
        }}
      >
        <Card label="Truyện" value={counts?.novels ?? 0} />
        <Card label="Chương" value={counts?.chapters ?? 0} />
        <Card label="Tác giả" value={counts?.authors ?? 0} />
        <Card label="Tag" value={counts?.tags ?? 0} />
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Top truyện (7 ngày)</h3>
        {top.length === 0 ? (
          <div>Chưa có dữ liệu.</div>
        ) : (
          <ul>
            {top.map((it) => (
              <li key={it.novel.id}>
                {it.novel.title} — {it.views} views • cập nhật{" "}
                <Time value={it.novel.updated_at} withTime />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div style={{ display: "flex", gap: 10 }}>
        <Link href="/novels" style={btn}>
          ➕ Tạo truyện
        </Link>
        <Link href="/novels/list" style={btn}>
          📚 Danh sách truyện
        </Link>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
const btn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: 8,
  textDecoration: "none",
  color: "#111",
};
