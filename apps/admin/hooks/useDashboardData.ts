import { useEffect, useState } from "react";
import {
  fetchOverview,
  fetchSeries,
  fetchTop,
  type Overview,
  type SeriesItem,
  type TopItem,
} from "@/app/lib/stats";

type DashboardState = {
  loading: boolean;
  error: string;
  overview: Overview | null;
  series: SeriesItem[];
  top: TopItem[];
};

export function useDashboardData({ token }: { token: string | null }) {
  const [state, setState] = useState<DashboardState>({
    loading: true,
    error: "",
    overview: null,
    series: [],
    top: [],
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const [ov, ser, top] = await Promise.all([
          fetchOverview(),
          fetchSeries(7, "day"),
          fetchTop(7, 10),
        ]);
        if (cancelled) return;
        setState({
          loading: false,
          error: "",
          overview: ov ?? { novels: 0, chapters: 0, authors: 0, tags: 0 },
          series: ser ?? [],
          top: top ?? [],
        });
      } catch (error: any) {
        if (cancelled) return;
        setState({
          loading: false,
          error: error?.message ?? "Không tải được dữ liệu dashboard",
          overview: null,
          series: [],
          top: [],
        });
      }
    };

    // nếu chưa đăng nhập có thể skip, nhưng vẫn thử tải để báo lỗi
    void run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return state;
}
