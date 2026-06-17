"use client";

import { useEffect, useRef, useState } from "react";

type ChartData = {
  candles: { time: string; open: number; high: number; low: number; close: number }[];
  ma20: { time: string; value: number }[];
  ma60: { time: string; value: number }[];
  bbUpper: { time: string; value: number }[];
  bbLower: { time: string; value: number }[];
};

export default function StockChart({ symbol }: { symbol: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let disposed = false;
    let chart: import("lightweight-charts").IChartApi | null = null;

    (async () => {
      try {
        const [{ createChart, ColorType, LineStyle }, res] = await Promise.all([
          import("lightweight-charts"),
          fetch(`/api/chart/${encodeURIComponent(symbol)}?range=6mo`).then((r) => r.json()),
        ]);
        if (disposed || !ref.current) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data: ChartData = res.data;

        chart = createChart(ref.current, {
          height: 280,
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#9aa3b2",
          },
          grid: {
            vertLines: { color: "rgba(255,255,255,0.04)" },
            horzLines: { color: "rgba(255,255,255,0.04)" },
          },
          rightPriceScale: { borderColor: "#2a2f3a" },
          timeScale: { borderColor: "#2a2f3a" },
          crosshair: { mode: 0 },
        });

        const candle = chart.addCandlestickSeries({
          upColor: "#22c55e",
          downColor: "#ef4444",
          borderUpColor: "#22c55e",
          borderDownColor: "#ef4444",
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
        });
        candle.setData(data.candles);

        const ma20 = chart.addLineSeries({ color: "#3b82f6", lineWidth: 2, priceLineVisible: false });
        ma20.setData(data.ma20);
        const ma60 = chart.addLineSeries({ color: "#f59e0b", lineWidth: 2, priceLineVisible: false });
        ma60.setData(data.ma60);

        const bbU = chart.addLineSeries({ color: "rgba(148,163,184,0.6)", lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false });
        bbU.setData(data.bbUpper);
        const bbL = chart.addLineSeries({ color: "rgba(148,163,184,0.6)", lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false });
        bbL.setData(data.bbLower);

        chart.timeScale().fitContent();
        setStatus("ready");
      } catch {
        if (!disposed) setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      if (chart) chart.remove();
    };
  }, [symbol]);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, fontSize: 11, marginBottom: 6, color: "var(--text-dim)" }}>
        <span style={{ color: "#3b82f6" }}>— MA20</span>
        <span style={{ color: "#f59e0b" }}>— MA60</span>
        <span style={{ color: "#94a3b8" }}>···· 볼린저밴드(20,2σ)</span>
      </div>
      <div ref={ref} style={{ width: "100%", minHeight: 280 }} />
      {status === "loading" && <span className="spin">차트 불러오는 중…</span>}
      {status === "error" && <span className="spin">차트 데이터를 불러오지 못했습니다.</span>}
    </div>
  );
}
