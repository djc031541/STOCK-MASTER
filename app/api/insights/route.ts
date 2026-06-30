import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { buildBriefing, buildMarketRadar, sectorOf } from "@/lib/insights";
import { getQuote } from "@/lib/datasources/yahoo";
import type { RiskProfile } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = (searchParams.get("market") || "US").toUpperCase();
  const user = await getCurrentUser();
  const risk =
    (searchParams.get("risk") as RiskProfile) ||
    (user.riskProfile as RiskProfile) ||
    "중립";
  const watch = await prisma.watchlist.findMany({ where: { userId: user.id } });
  const symbols = watch.length ? watch.map((w) => w.symbol) : ["NVDA", "AAPL", "JPM", "AMD", "GOOGL"];

  const [briefing, radar] = await Promise.all([
    buildBriefing(symbols, risk, market),
    buildMarketRadar(market),
  ]);

  const riskAlerts = briefing.focus.flatMap((s) => {
    const alerts: { symbol: string; severity: "HIGH" | "MED" | "LOW"; title: string; detail: string }[] = [];
    if (s.rsi != null && s.rsi >= 70) alerts.push({ symbol: s.symbol, severity: "HIGH", title: "RSI 과열", detail: `RSI ${s.rsi.toFixed(0)}로 단기 조정 위험` });
    if (s.newsScore < 0) alerts.push({ symbol: s.symbol, severity: "MED", title: "뉴스 악재 증가", detail: `뉴스 감성 ${s.newsScore}점` });
    if (s.trend === "하락" && s.score < 0) alerts.push({ symbol: s.symbol, severity: "MED", title: "하락 추세 동조", detail: "이동평균 추세와 종합 점수가 모두 약세" });
    const saved = watch.find((w) => w.symbol === s.symbol);
    if (saved?.stopLoss && s.price <= saved.stopLoss * 1.03) alerts.push({ symbol: s.symbol, severity: "HIGH", title: "손절가 근접", detail: `현재가가 손절가 ${saved.stopLoss.toLocaleString("ko-KR")} 근처` });
    return alerts;
  });

  const portfolio = user.portfolio;
  const holdings = portfolio?.holdings ?? [];
  const sectorValue = new Map<string, number>();
  let totalCost = 0;
  for (const h of holdings) {
    const cost = h.qty * h.avgBuyPrice;
    totalCost += cost;
    sectorValue.set(sectorOf(h.symbol), (sectorValue.get(sectorOf(h.symbol)) ?? 0) + cost);
  }
  const concentration = [...sectorValue.entries()].sort((a, b) => b[1] - a[1])[0];
  const rebalance = {
    summary: holdings.length ? "보유 비중과 손익 기준 리밸런싱 점검" : "보유종목을 추가하면 리밸런싱 분석이 활성화됩니다.",
    suggestions: [
      concentration && totalCost && concentration[1] / totalCost > 0.45
        ? `${concentration[0]} 비중이 ${(concentration[1] / totalCost * 100).toFixed(0)}%로 높습니다. 신규 매수는 다른 섹터로 분산하세요.`
        : "특정 섹터 쏠림은 과도하지 않습니다.",
      portfolio && portfolio.cashBalance < portfolio.seedAmount * 0.08
        ? "현금 비중이 낮습니다. 변동성 장에서는 일부 현금을 확보하세요."
        : "현금 여력은 급한 위험 신호가 아닙니다.",
      holdings.filter((h) => h.avgBuyPrice > 0).length >= 3
        ? "손실 종목은 추가 매수보다 손절/회복 시나리오를 먼저 정리하세요."
        : "보유 종목 수가 적어 개별 종목 리스크가 큽니다.",
    ].filter(Boolean),
  };

  // Quick quote touch: keeps cache warm for visible watch symbols.
  await Promise.allSettled(symbols.slice(0, 3).map((s) => getQuote(s)));

  return NextResponse.json({ ok: true, risk, market, briefing, riskAlerts, rebalance, radar });
}
