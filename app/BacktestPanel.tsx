"use client";

import { useState } from "react";

type Trade = { date: string; action: "BUY" | "SELL"; price: number };
type Result = {
  from: string;
  to: string;
  bars: number;
  trades: Trade[];
  strategyReturnPct: number;
  buyHoldReturnPct: number;
  winRate: number;
  maxDrawdownPct: number;
};

export default function BacktestPanel({ symbol, risk }: { symbol: string; risk: string }) {
  const [data, setData] = useState<Result | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function run() {
    setStatus("loading");
    try {
      const r = await fetch(`/api/backtest?symbol=${encodeURIComponent(symbol)}&risk=${encodeURIComponent(risk)}&range=2y`).then((x) => x.json());
      if (r.ok) { setData(r.data); setStatus("idle"); }
      else setStatus("error");
    } catch { setStatus("error"); }
  }

  if (status === "idle" && !data) {
    return (
      <button className="btn" onClick={run} style={{ fontSize: 12 }}>📊 백테스트 (최근 2년)</button>
    );
  }
  if (status === "loading") return <span className="spin">백테스트 계산 중… (수십 초)</span>;
  if (status === "error" || !data) return <span className="spin">백테스트를 불러오지 못했습니다.</span>;

  const stratUp = data.strategyReturnPct >= 0;
  const beatHold = data.strategyReturnPct >= data.buyHoldReturnPct;

  return (
    <div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 8 }}>
        <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px" }}>
          <div className="muted" style={{ fontSize: 11 }}>전략 수익률</div>
          <div className={stratUp ? "up" : "down"} style={{ fontSize: 16, fontWeight: 600 }}>{stratUp ? "+" : ""}{data.strategyReturnPct.toFixed(1)}%</div>
        </div>
        <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px" }}>
          <div className="muted" style={{ fontSize: 11 }}>매수후보유</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{data.buyHoldReturnPct >= 0 ? "+" : ""}{data.buyHoldReturnPct.toFixed(1)}%</div>
        </div>
        <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px" }}>
          <div className="muted" style={{ fontSize: 11 }}>승률</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{data.winRate.toFixed(0)}%</div>
        </div>
        <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px" }}>
          <div className="muted" style={{ fontSize: 11 }}>최대낙폭(MDD)</div>
          <div className="down" style={{ fontSize: 16, fontWeight: 600 }}>-{data.maxDrawdownPct.toFixed(1)}%</div>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>
        {data.from} ~ {data.to} · 거래 {data.trades.length}건 · {beatHold ? "✅ 전략이 보유보다 우위" : "⚠️ 보유가 더 나았음"}
      </div>
      {data.trades.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {data.trades.slice(-8).map((t, i) => (
            <span key={i} className={`chip ${t.action === "BUY" ? "up" : "down"}`} style={{ fontSize: 10.5 }}>
              {t.action === "BUY" ? "매수" : "매도"} {t.date.slice(2)} {t.price.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
